import random
from datetime import datetime, timedelta, timezone

from django.contrib.auth import get_user_model
from django.db import transaction, models
from django.utils import timezone as dj_tz
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from core import settings as core_settings
from django.conf import settings
from .models import PhoneOTP, Category, PsychologicalIssue, Form, FormResponse, QuestionResponse, UserProfile, SessionRequest, TherapistOffer, TherapistProfile, TherapySession, ChatMessage, Post, PostReaction, DeviceToken, Notification, SupportChat, Wallet, WalletTransaction
from .serializers import (
	RequestOTPSerializer, VerifyOTPSerializer, CategorySerializer, PsychologicalIssueSerializer,
	FormSerializer, FormResponseSubmitSerializer, UserProfileSerializer, UserProfileUpdateSerializer,
	FormResponseRequestSerializer, SessionRequestSerializer, TherapistOfferSerializer, TherapistOfferCreateSerializer,
	TherapistProfileSerializer, TherapistProfileUpdateSerializer, TherapistProfilePublicSerializer,
	TherapySessionSerializer, ChatMessageSerializer, SupportChatSerializer,
	PostSerializer, PostCreateSerializer, PostReactionSerializer, PostReactionCreateSerializer,
	DeviceTokenSerializer, DeviceTokenRegisterSerializer, NotificationSerializer, SendNotificationSerializer,
	WalletSerializer, WalletTransactionSerializer
)
from .sms import get_sms_provider
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.http import HttpResponse
import logging

logger = logging.getLogger(__name__)


def _now() -> datetime:
	return dj_tz.now()


def _generate_code() -> str:
	return f"{random.randint(0, 999999):06d}"


# Wallet defaults (overridable via Django settings)
INITIAL_WALLET_CREDIT = getattr(settings, "INITIAL_WALLET_CREDIT", 2_000_000)
INITIAL_WALLET_DESCRIPTION = getattr(
	settings,
	"INITIAL_WALLET_DESCRIPTION",
	"اعتبار اولیه ثبت نام",
)


ADMIN_WALLET_USERNAME = getattr(settings, "ADMIN_WALLET_USERNAME", "admin")


def _get_wallet_for_update(user, seed_initial_credit=True):
	"""دریافت کیف پول با قفل برای تراکنش ایمن"""
	wallet, created = Wallet.objects.select_for_update().get_or_create(user=user)
	if created and seed_initial_credit and wallet.balance <= 0:
		# Seed initial signup credit for users that didn't have a wallet yet
		wallet.balance = INITIAL_WALLET_CREDIT
		wallet.reserved_balance = 0
		wallet.save(update_fields=['balance', 'reserved_balance'])
		_create_wallet_transaction(
			wallet,
			user,
			WalletTransaction.TYPE_CREDIT,
			INITIAL_WALLET_CREDIT,
			description=INITIAL_WALLET_DESCRIPTION,
			metadata={'source': 'signup_bonus'}
		)
	return wallet


def _get_admin_wallet_for_update():
	"""دریافت کیف پول مدیر برای نگهداری کارمزد پلتفرم"""
	User = get_user_model()
	admin_user = User.objects.filter(username=ADMIN_WALLET_USERNAME, is_active=True).first()
	if not admin_user:
		admin_user = User.objects.filter(is_superuser=True, is_active=True).first()
	if not admin_user:
		admin_user = User.objects.filter(is_staff=True, is_active=True).first()
	if not admin_user:
		raise ValueError("ADMIN_USER_NOT_FOUND")
	wallet, _ = Wallet.objects.select_for_update().get_or_create(user=admin_user)
	return wallet


def _create_wallet_transaction(wallet, user, tx_type, amount, description='', session_request=None, metadata=None):
	"""ایجاد رکورد تراکنش کیف پول"""
	return WalletTransaction.objects.create(
		wallet=wallet,
		user=user,
		transaction_type=tx_type,
		amount=amount,
		currency=wallet.currency,
		description=description,
		balance_after=wallet.balance,
		session_request=session_request,
		metadata=metadata or {}
	)


def _hold_funds(user, amount, session_request):
	"""بلوکه کردن مبلغ در کیف پول کاربر"""
	wallet = _get_wallet_for_update(user)
	if amount <= 0:
		return wallet
	if wallet.balance < amount:
		raise ValueError("INSUFFICIENT_FUNDS")
	wallet.balance -= amount
	wallet.reserved_balance += amount
	wallet.save(update_fields=['balance', 'reserved_balance'])
	_create_wallet_transaction(
		wallet,
		user,
		WalletTransaction.TYPE_HOLD,
		amount,
		description='بلوکه جهت درخواست جلسه',
		session_request=session_request,
		metadata={'session_request_id': session_request.id if session_request else None}
	)
	return wallet


def _release_hold(user, amount, session_request, reason='آزادسازی مبلغ'):
	"""آزادسازی مبلغ بلوکه شده"""
	wallet = _get_wallet_for_update(user)
	if amount <= 0:
		return wallet
	release_amount = min(amount, wallet.reserved_balance)
	if release_amount <= 0:
		return wallet
	wallet.reserved_balance = max(wallet.reserved_balance - release_amount, 0)
	wallet.balance += release_amount
	wallet.save(update_fields=['balance', 'reserved_balance'])
	_create_wallet_transaction(
		wallet,
		user,
		WalletTransaction.TYPE_RELEASE,
		release_amount,
		description=reason,
		session_request=session_request,
		metadata={'session_request_id': session_request.id if session_request else None}
	)
	return wallet


def _transfer_to_therapist(session_request):
	"""انتقال مبلغ بلوکه شده بیمار به کیف پول درمانگر"""
	if session_request.payment_status == 'PAID':
		return
	if session_request.price <= 0:
		session_request.payment_status = 'PAID'
		session_request.save(update_fields=['payment_status'])
		return
	patient = session_request.patient
	therapist = session_request.approved_by
	if not patient or not therapist:
		raise ValueError("MISSING_USERS")
	patient_wallet = _get_wallet_for_update(patient)
	therapist_wallet = _get_wallet_for_update(therapist)
	admin_amount = int(session_request.price * 0.10)
	therapist_amount = session_request.price - admin_amount
	admin_wallet = _get_admin_wallet_for_update()

	if session_request.payment_status == 'HELD':
		if patient_wallet.reserved_balance < session_request.price:
			raise ValueError("INSUFFICIENT_HELD_FUNDS")
		# خروج از بلوکه بیمار
		patient_wallet.reserved_balance -= session_request.price
		patient_wallet.save(update_fields=['reserved_balance'])
	else:
		if patient_wallet.balance < session_request.price:
			raise ValueError("INSUFFICIENT_FUNDS")
		patient_wallet.balance -= session_request.price
		patient_wallet.save(update_fields=['balance'])

	_create_wallet_transaction(
		patient_wallet,
		patient,
		WalletTransaction.TYPE_TRANSFER_OUT,
		session_request.price,
		description='انتقال مبلغ جلسه به درمانگر و ادمین',
		session_request=session_request,
		metadata={
			'session_request_id': session_request.id,
			'admin_share': admin_amount,
			'therapist_share': therapist_amount,
			'payment_status': session_request.payment_status
		}
	)

	# واریز به درمانگر
	therapist_wallet.balance += therapist_amount
	therapist_wallet.save(update_fields=['balance', 'reserved_balance'])
	_create_wallet_transaction(
		therapist_wallet,
		therapist,
		WalletTransaction.TYPE_TRANSFER_IN,
		therapist_amount,
		description='دریافت ۹۰٪ حق‌الزحمه جلسه',
		session_request=session_request,
		metadata={'session_request_id': session_request.id, 'split': '90_percent_therapist'}
	)

	# واریز سهم پلتفرم به کیف پول ادمین
	if admin_amount > 0:
		admin_wallet.balance += admin_amount
		admin_wallet.save(update_fields=['balance'])
		_create_wallet_transaction(
			admin_wallet,
			admin_wallet.user,
			WalletTransaction.TYPE_TRANSFER_IN,
			admin_amount,
			description='سهم ۱۰٪ پلتفرم از جلسه',
			session_request=session_request,
			metadata={'session_request_id': session_request.id, 'split': '10_percent_admin'}
		)

	# به‌روزرسانی وضعیت پرداخت
	session_request.payment_status = 'PAID'
	session_request.save(update_fields=['payment_status'])


@api_view(["POST"])
@permission_classes([AllowAny])
def request_otp(request):
	serializer = RequestOTPSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	phone = serializer.validated_data["phone"]

	logger.info("request_otp called for phone=%s", phone)

	# Throttle resends
	latest = PhoneOTP.objects.filter(phone=phone).order_by("-created_at").first()
	if latest and latest.resend_after > _now():
		seconds = int((latest.resend_after - _now()).total_seconds())
		return Response({"detail": f"Please wait {seconds}s before requesting a new OTP."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

	code = _generate_code()
	expires_at = _now() + timedelta(seconds=core_settings.OTP_EXPIRY_SECONDS)
	resend_after = _now() + timedelta(seconds=core_settings.OTP_RESEND_WINDOW_SECONDS)
	PhoneOTP.objects.create(phone=phone, code=code, expires_at=expires_at, resend_after=resend_after)

	message = f"Your login code is {code}. It expires in {core_settings.OTP_EXPIRY_SECONDS // 60} minutes."
	get_sms_provider().send(phone, message)
	logger.info("OTP sent to %s: %s", phone, code)
	print(f"\n{'='*60}")
	print(f"OTP CODE for {phone}: {code}")
	print(f"{'='*60}\n")

	payload = {"success": True}
	if core_settings.DEBUG:
		payload["debug_otp"] = code
	return Response(payload)


@api_view(["POST"])
@permission_classes([AllowAny])
def verify_otp(request):
	serializer = VerifyOTPSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	phone = serializer.validated_data["phone"]
	code = serializer.validated_data["otp"]

	otp = PhoneOTP.objects.filter(phone=phone).order_by("-created_at").first()
	if not otp:
		return Response({"detail": "No OTP requested for this phone."}, status=status.HTTP_400_BAD_REQUEST)

	if otp.verified:
		return Response({"detail": "OTP already used."}, status=status.HTTP_400_BAD_REQUEST)

	if otp.expires_at < _now():
		return Response({"detail": "OTP expired."}, status=status.HTTP_400_BAD_REQUEST)

	if otp.attempts >= core_settings.OTP_MAX_ATTEMPTS:
		return Response({"detail": "Too many attempts."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

	if otp.code != code:
		otp.attempts += 1
		otp.save(update_fields=["attempts"])
		return Response({"detail": "Invalid code."}, status=status.HTTP_400_BAD_REQUEST)

	# Success
	otp.verified = True
	otp.save(update_fields=["verified"])

	User = get_user_model()
	user, created = User.objects.get_or_create(username=phone, defaults={"is_active": True})
	if created:
		user.set_unusable_password()
		user.save(update_fields=["password"])  # store unusable password hash

	refresh = RefreshToken.for_user(user)
	return Response({
		"access": str(refresh.access_token),
		"refresh": str(refresh),
		"user": {"id": user.id, "phone": user.username},
	})


@api_view(["POST"])
@permission_classes([AllowAny])
def dev_login(request):
	"""
	Direct login endpoint for development - bypasses OTP
	⚠️ TODO: REMOVE OR DISABLE THIS BEFORE PRODUCTION DEPLOYMENT ⚠️
	This is a temporary feature for faster development.
	"""
	# Only allow in DEBUG mode for security
	if not core_settings.DEBUG:
		return Response({"detail": "This endpoint is only available in DEBUG mode."}, status=status.HTTP_403_FORBIDDEN)
	
	phone = request.data.get("phone")
	if not phone:
		return Response({"detail": "Phone number is required."}, status=status.HTTP_400_BAD_REQUEST)
	
	# Create or get user
	User = get_user_model()
	user, created = User.objects.get_or_create(username=phone, defaults={"is_active": True})
	if created:
		user.set_unusable_password()
		user.save(update_fields=["password"])
	
	refresh = RefreshToken.for_user(user)
	return Response({
		"access": str(refresh.access_token),
		"refresh": str(refresh),
		"user": {"id": user.id, "phone": user.username},
	})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_categories(request):
	categories = Category.objects.filter(is_active=True).order_by('order', 'name')
	serializer = CategorySerializer(categories, many=True)
	return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_psychological_issues(request):
	from django.db.models import F

	issues = (
		PsychologicalIssue.objects.filter(is_active=True)
		.select_related('category')
		.order_by(F('category__order').asc(nulls_last=True), 'order', 'title')
	)
	serializer = PsychologicalIssueSerializer(issues, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_form(request, issue_id):
	"""دریافت فرم و سوالات مربوط به یک مسئله روانشناختی"""
	try:
		issue = PsychologicalIssue.objects.get(id=issue_id, is_active=True)
	except PsychologicalIssue.DoesNotExist:
		return Response({"detail": "مسئله یافت نشد"}, status=status.HTTP_404_NOT_FOUND)
	
	if not hasattr(issue, 'form') or not issue.form.is_active:
		return Response({"detail": "این مسئله فرم فعالی ندارد"}, status=status.HTTP_404_NOT_FOUND)
	
	form = issue.form
	serializer = FormSerializer(form, context={'request': request})
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def submit_form_response(request):
	"""ارسال پاسخ فرم"""
	# Check if user profile is complete
	profile, created = UserProfile.objects.get_or_create(user=request.user)
	if not profile.is_complete():
		missing_fields = profile.get_missing_fields()
		return Response({
			"detail": "لطفاً ابتدا اطلاعات پروفایل خود را تکمیل کنید",
			"profile_incomplete": True,
			"missing_fields": missing_fields
		}, status=status.HTTP_400_BAD_REQUEST)
	
	serializer = FormResponseSubmitSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	
	data = serializer.validated_data
	issue_id = data['psychological_issue_id']
	
	try:
		issue = PsychologicalIssue.objects.get(id=issue_id, is_active=True)
	except PsychologicalIssue.DoesNotExist:
		return Response({"detail": "مسئله یافت نشد"}, status=status.HTTP_404_NOT_FOUND)
	
	if not hasattr(issue, 'form') or not issue.form.is_active:
		return Response({"detail": "این مسئله فرم فعالی ندارد"}, status=status.HTTP_404_NOT_FOUND)
	
	form = issue.form
	is_group_therapy = data.get('is_group_therapy', False)
	session_price = form.session_price or 0
	
	# Create form response (allow multiple submissions)
	form_response = FormResponse.objects.create(
		form=form,
		user=request.user,
		psychological_issue=issue,
		is_group_therapy=is_group_therapy
	)
	
	# Create question responses
	questions_dict = {q.id: q for q in form.questions.filter(is_active=True)}
	
	for answer_data in data['answers']:
		question_id = answer_data['question_id']
		if question_id not in questions_dict:
			continue
		
		question = questions_dict[question_id]
		
		QuestionResponse.objects.create(
			form_response=form_response,
			question=question,
			answer_text=answer_data.get('answer_text'),
			answer_number=answer_data.get('answer_number'),
			answer_boolean=answer_data.get('answer_boolean')
		)
	
	# Handle group therapy logic
	if is_group_therapy and form.group_therapy_enabled:
		# Find existing group therapy SessionRequests for this form/issue to exclude their patients
		existing_group_requests = SessionRequest.objects.filter(
			psychological_issue=issue,
			is_group_therapy=True
		).prefetch_related('patients')
		
		# Get all user IDs that are already in a group
		excluded_user_ids = set()
		for existing_request in existing_group_requests:
			excluded_user_ids.update(existing_request.patients.values_list('id', flat=True))
		
		# Check if current user is already in a group
		if request.user.id in excluded_user_ids:
			return Response({
				"success": False,
				"detail": "شما قبلاً در یک گروه درمانی برای این مسئله ثبت نام کرده‌اید. نمی‌توانید در گروه دیگری شرکت کنید.",
				"response_id": form_response.id,
				"is_group_therapy": True,
				"already_in_group": True
			}, status=status.HTTP_400_BAD_REQUEST)
		
		# Find pending group therapy responses for the same form and issue
		# Exclude responses that:
		# 1. Already have a SessionRequest (primary FormResponse)
		# 2. Belong to users who are already in an existing group
		pending_responses = FormResponse.objects.filter(
			form=form,
			psychological_issue=issue,
			is_group_therapy=True,
			session_requests__isnull=True  # No session request created yet (excludes primary FormResponse)
		).exclude(
			id=form_response.id
		).exclude(
			user_id__in=excluded_user_ids  # Exclude users already in a group
		).select_related('user')
		
		# Include the current response
		all_pending_responses = list(pending_responses) + [form_response]
		
		# Check if we have enough patients
		if len(all_pending_responses) >= form.group_therapy_max_patients:
			# Create session request with all patients
			patients_list = [fr.user for fr in all_pending_responses]
			
			session_request = SessionRequest.objects.create(
				form_response=all_pending_responses[0],  # Primary form response
				patient=patients_list[0],  # Primary patient for backward compatibility
				psychological_issue=issue,
				status='PENDING',
				is_group_therapy=True,
				price=session_price * len(patients_list),
				price_currency='IRR',
				payment_status='NOT_REQUIRED'
			)
			# Set patients in ManyToMany relationship (this automatically saves)
			session_request.patients.set(patients_list)
			# Verify patients were saved
			saved_patients_count = session_request.patients.count()
			logger.info(f"Created group therapy SessionRequest {session_request.id} with {len(patients_list)} patients (saved: {saved_patients_count})")
			if saved_patients_count != len(patients_list):
				logger.error(f"Warning: Expected {len(patients_list)} patients but only {saved_patients_count} were saved!")
			
			# Send to all therapists via WebSocket
			channel_layer = get_channel_layer()
			if channel_layer:
				serializer = SessionRequestSerializer(session_request)
				async_to_sync(channel_layer.group_send)(
					'therapist_requests',
					{
						'type': 'new_request',
						'data': serializer.data
					}
				)
			
			return Response({
				"success": True,
				"message": f"پاسخ با موفقیت ثبت شد. گروه درمانی با {len(patients_list)} بیمار تشکیل شد و درخواست جلسه ایجاد شد",
				"response_id": form_response.id,
				"session_request_id": session_request.id,
				"is_group_therapy": True,
				"patients_count": len(patients_list)
			}, status=status.HTTP_201_CREATED)
		else:
			# Not enough patients yet, wait for more
			remaining = form.group_therapy_max_patients - len(all_pending_responses)
			return Response({
				"success": True,
				"message": f"پاسخ شما ثبت شد. در انتظار {remaining} بیمار دیگر برای تشکیل گروه درمانی...",
				"response_id": form_response.id,
				"is_group_therapy": True,
				"pending": True,
				"current_count": len(all_pending_responses),
				"required_count": form.group_therapy_max_patients
			}, status=status.HTTP_201_CREATED)
	else:
		# Regular (non-group) therapy - create session request
		session_request_status = 'PENDING'
		payment_status = 'PENDING' if session_price > 0 else 'NOT_REQUIRED'

		session_request = SessionRequest.objects.create(
			form_response=form_response,
			patient=request.user,
			psychological_issue=issue,
			status=session_request_status,
			is_group_therapy=False,
			price=session_price,
			price_currency='IRR',
			payment_status=payment_status
		)
		session_request.patients.add(request.user)  # Add patient to ManyToMany for consistency
		
		# Send to therapists immediately so they can propose a price
		channel_layer = get_channel_layer()
		if channel_layer:
			serializer = SessionRequestSerializer(session_request, context={'request': request})
			async_to_sync(channel_layer.group_send)(
				'therapist_requests',
				{
					'type': 'new_request',
					'data': serializer.data
				}
			)
		
		return Response({
			"success": True,
			"message": "پاسخ ثبت شد و درخواست جلسه برای درمانگران ارسال شد. درمانگران می‌توانند قیمت پیشنهادی خود را ارسال کنند.",
			"response_id": form_response.id,
			"session_request_id": session_request.id,
			"is_group_therapy": False,
			"requires_payment": payment_status == 'PENDING',
			"price": session_price,
		}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
	"""دریافت پروفایل کاربر"""
	profile, created = UserProfile.objects.get_or_create(user=request.user)
	serializer = UserProfileSerializer(profile)
	return Response(serializer.data)


@api_view(["PUT", "PATCH", "POST"])
@permission_classes([IsAuthenticated])
def update_user_profile(request):
	"""بروزرسانی پروفایل کاربر"""
	profile, created = UserProfile.objects.get_or_create(user=request.user)
	
	if request.method == 'PUT':
		serializer = UserProfileUpdateSerializer(profile, data=request.data)
	else:
		# For PATCH and POST, allow partial updates
		serializer = UserProfileUpdateSerializer(profile, data=request.data, partial=True)
	
	serializer.is_valid(raise_exception=True)
	serializer.save()
	
	# Return updated profile with complete status
	response_serializer = UserProfileSerializer(profile)
	return Response(response_serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_session_requests(request):
	"""لیست درخواست‌های جلسه برای تراپیست‌ها"""
	requests = SessionRequest.objects.filter(status__in=['PENDING', 'PENDING_PAYMENT']).select_related(
		'patient', 'psychological_issue', 'form_response'
	).prefetch_related(
		'form_response__question_responses__question',
		'patients',  # Prefetch patients for group therapy
		'patients__profile'  # Prefetch patient profiles
	).order_by('-created_at')
	
	serializer = SessionRequestSerializer(requests, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_session_request(request, request_id):
	"""جزئیات یک درخواست جلسه"""
	try:
		session_request = SessionRequest.objects.select_related(
			'patient', 'psychological_issue', 'form_response', 'approved_by', 'denied_by'
		).prefetch_related(
			'form_response__question_responses__question',
			'patients',  # Prefetch patients for group therapy
			'patients__profile',  # Prefetch patient profiles
			'offers__therapist__therapist_profile'
		).get(id=request_id)
	except SessionRequest.DoesNotExist:
		return Response({"detail": "درخواست یافت نشد"}, status=status.HTTP_404_NOT_FOUND)
	
	serializer = SessionRequestSerializer(session_request, context={'request': request})
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_session_request_offer(request, request_id):
	"""Therapist proposes a price for a pending request"""
	serializer = TherapistOfferCreateSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	data = serializer.validated_data

	try:
		session_request = SessionRequest.objects.select_for_update().get(
			id=request_id,
			status='PENDING',
			is_group_therapy=False
		)
	except SessionRequest.DoesNotExist:
		return Response(
			{"detail": "درخواست یافت نشد یا امکان ارسال پیشنهاد برای آن وجود ندارد"},
			status=status.HTTP_404_NOT_FOUND
		)

	# Ensure therapist is approved
	try:
		therapist_profile = TherapistProfile.objects.get(user=request.user, is_approved=True)
	except TherapistProfile.DoesNotExist:
		return Response(
			{"detail": "شما به عنوان تراپیست معتبر نیستید"},
			status=status.HTTP_403_FORBIDDEN
		)

	offer, created = TherapistOffer.objects.update_or_create(
		session_request=session_request,
		therapist=request.user,
		defaults={
			'price': data['price'],
			'message': data.get('message', ''),
			'status': 'PENDING'
		}
	)

	# Notify patient of new offer
	channel_layer = get_channel_layer()
	if channel_layer:
		try:
			serializer = SessionRequestSerializer(session_request, context={'request': request})
			therapist_data = TherapistProfileSerializer(therapist_profile, context={'request': request}).data
			async_to_sync(channel_layer.group_send)(
				f'patient_{session_request.patient.id}_notifications',
				{
					'type': 'therapist_proposed',
					'message': 'یک تراپیست قیمت پیشنهادی ارسال کرد',
					'data': {
						'session_request': serializer.data,
						'therapist_profile': therapist_data,
						'offer': TherapistOfferSerializer(offer, context={'request': request}).data,
					}
				}
			)
		except Exception:
			logger.exception('Failed to send therapist proposed notification')

	return Response({
		"success": True,
		"message": "پیشنهاد قیمت شما ارسال شد",
		"offer": TherapistOfferSerializer(offer, context={'request': request}).data
	})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_session_request_offers(request, request_id):
	"""List all offers for a session request"""
	try:
		session_request = SessionRequest.objects.select_related('patient').prefetch_related('offers__therapist__therapist_profile').get(id=request_id)
	except SessionRequest.DoesNotExist:
		return Response({"detail": "درخواست یافت نشد"}, status=status.HTTP_404_NOT_FOUND)

	if request.user != session_request.patient and not session_request.offers.filter(therapist=request.user).exists():
		return Response({"detail": "دسترسی ندارید"}, status=status.HTTP_403_FORBIDDEN)

	offers = session_request.offers.all().order_by('-created_at')
	serializer = TherapistOfferSerializer(offers, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def accept_session_request_offer(request, request_id, offer_id=None):
	"""Patient accepts a therapist offer"""
	# Allow offer_id to come from URL path or request body for backward compatibility
	offer_id = offer_id or request.data.get('offer_id')
	if not offer_id:
		return Response({"detail": "offer_id مورد نیاز است"}, status=status.HTTP_400_BAD_REQUEST)

	try:
		offer = TherapistOffer.objects.select_for_update().select_related('session_request', 'therapist').get(
			id=offer_id,
			session_request_id=request_id,
			status='PENDING'
		)
	except TherapistOffer.DoesNotExist:
		return Response({"detail": "پیشنهاد یافت نشد یا دیگر قابل قبول نیست"}, status=status.HTTP_404_NOT_FOUND)

	session_request = offer.session_request
	if request.user != session_request.patient:
		return Response({"detail": "شما به این درخواست دسترسی ندارید"}, status=status.HTTP_403_FORBIDDEN)
	if session_request.status != 'PENDING':
		return Response({"detail": "این درخواست دیگر در وضعیت مناسب نیست"}, status=status.HTTP_400_BAD_REQUEST)

	# Accept this offer and reject others
	offer.status = 'ACCEPTED'
	offer.save(update_fields=['status'])
	session_request.status = 'APPROVED'
	session_request.approved_by = offer.therapist
	session_request.patient_choice = 'ACCEPTED'
	session_request.patient_accepted_at = dj_tz.now()
	session_request.price = offer.price
	session_request.payment_status = 'NOT_REQUIRED' if offer.price <= 0 else 'PENDING'
	session_request.save(update_fields=['status', 'approved_by', 'patient_choice', 'patient_accepted_at', 'price', 'payment_status'])

	session_request.offers.exclude(id=offer.id).update(status='REJECTED')

	# Create therapy session
	therapy_session, created = TherapySession.objects.get_or_create(
		session_request=session_request,
		defaults={
			'patient': session_request.patient,
			'therapist': offer.therapist,
			'is_active': True,
			'is_group_therapy': False
		}
	)
	if created:
		therapy_session.patients.add(session_request.patient)

	# Transfer payment after patient accepts the offer
	if session_request.payment_status != 'PAID' and session_request.price > 0:
		try:
			_transfer_to_therapist(session_request)
		except ValueError as exc:
			return Response(
				{"detail": f"خطا در انتقال مبلغ: {str(exc)}"},
				status=status.HTTP_400_BAD_REQUEST
			)

	# Send notifications
	channel_layer = get_channel_layer()
	if channel_layer:
		serializer = SessionRequestSerializer(session_request, context={'request': request})
		therapy_serializer = TherapySessionSerializer(therapy_session, context={'request': request})
		async_to_sync(channel_layer.group_send)(
			'therapist_requests',
			{
				'type': 'request_updated',
				'data': serializer.data
			}
		)
		async_to_sync(channel_layer.group_send)(
			f'patient_{session_request.patient.id}_notifications',
			{
				'type': 'therapy_session_started',
				'message': 'جلسه درمانی شما شروع شد',
				'data': {
					'therapy_session': therapy_serializer.data,
					'is_group_therapy': False,
				}
			}
		)

	return Response({
		"success": True,
		"message": "پیشنهاد تراپیست انتخاب شد و جلسه درمانی شروع شد",
		"data": TherapySessionSerializer(therapy_session, context={'request': request}).data
	})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic

def reject_session_request_offer(request, request_id, offer_id=None):
	"""Patient rejects a therapist offer and keeps the request open"""
	# Allow offer_id to come from URL path or request body for backward compatibility
	offer_id = offer_id or request.data.get('offer_id')
	if not offer_id:
		return Response({"detail": "offer_id مورد نیاز است"}, status=status.HTTP_400_BAD_REQUEST)

	try:
		offer = TherapistOffer.objects.select_for_update().select_related('session_request').get(
			id=offer_id,
			session_request_id=request_id,
			status='PENDING'
		)
	except TherapistOffer.DoesNotExist:
		return Response({"detail": "پیشنهاد یافت نشد یا دیگر قابل رد نیست"}, status=status.HTTP_404_NOT_FOUND)

	session_request = offer.session_request
	if request.user != session_request.patient:
		return Response({"detail": "شما به این درخواست دسترسی ندارید"}, status=status.HTTP_403_FORBIDDEN)
	if session_request.status != 'PENDING':
		return Response({"detail": "این درخواست دیگر در وضعیت مناسب نیست"}, status=status.HTTP_400_BAD_REQUEST)

	offer.status = 'REJECTED'
	offer.save(update_fields=['status'])

	return Response({
		"success": True,
		"message": "پیشنهاد تراپیست رد شد و درخواست برای سایر تراپیست‌ها باز ماند",
		"offer": TherapistOfferSerializer(offer, context={'request': request}).data
	})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def pay_for_session_request(request, request_id):
	"""پرداخت هزینه جلسه از کیف پول کاربر"""
	try:
		session_request = SessionRequest.objects.select_for_update().get(
			id=request_id,
			patient=request.user,
			is_group_therapy=False
		)
	except SessionRequest.DoesNotExist:
		return Response({"detail": "درخواست یافت نشد"}, status=status.HTTP_404_NOT_FOUND)
	
	if session_request.price <= 0:
		return Response({"detail": "این درخواست نیاز به پرداخت ندارد"}, status=status.HTTP_400_BAD_REQUEST)
	
	if session_request.status != 'PENDING_PAYMENT' or session_request.payment_status not in ['PENDING', 'RELEASED']:
		return Response({"detail": "این درخواست در وضعیت مناسب برای پرداخت نیست"}, status=status.HTTP_400_BAD_REQUEST)
	
	try:
		wallet = _hold_funds(request.user, session_request.price, session_request)
	except ValueError:
		current_wallet = _get_wallet_for_update(request.user)
		return Response(
			{
				"detail": "موجودی کیف پول کافی نیست",
				"balance": current_wallet.balance,
				"reserved": current_wallet.reserved_balance,
				"required": session_request.price
			},
			status=status.HTTP_400_BAD_REQUEST
		)
	
	# Change request status to visible for therapists
	session_request.status = 'PENDING'
	session_request.payment_status = 'HELD'
	session_request.save(update_fields=['status', 'payment_status'])
	
	# Notify therapists via WebSocket
	channel_layer = get_channel_layer()
	if channel_layer:
		serializer = SessionRequestSerializer(session_request, context={'request': request})
		async_to_sync(channel_layer.group_send)(
			'therapist_requests',
			{
				'type': 'new_request',
				'data': serializer.data
			}
		)
	
	return Response({
		"success": True,
		"message": "مبلغ پرداخت و بلوکه شد. درخواست برای درمانگران ارسال شد.",
		"wallet": WalletSerializer(wallet).data,
		"session_request": SessionRequestSerializer(session_request, context={'request': request}).data
	})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def get_wallet(request):
	"""دریافت وضعیت کیف پول و ۲۰ تراکنش اخیر"""
	wallet = _get_wallet_for_update(request.user)
	serializer = WalletSerializer(wallet)
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def approve_session_request(request, request_id):
	"""تایید درخواست جلسه توسط تراپیست"""
	try:
		session_request = SessionRequest.objects.select_for_update().prefetch_related('patients').get(
			id=request_id,
			status='PENDING'
		)
	except SessionRequest.DoesNotExist:
		return Response(
			{"detail": "درخواست یافت نشد یا قبلاً پردازش شده است"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	# Ensure payment is ready for non-group therapy
	if not session_request.is_group_therapy and session_request.payment_status not in ['HELD', 'PAID']:
		return Response(
			{"detail": "این درخواست هنوز پرداخت نشده است"},
			status=status.HTTP_400_BAD_REQUEST
		)
	
	from django.utils import timezone as dj_tz
	
	# Update request status
	session_request.status = 'APPROVED'
	session_request.approved_by = request.user
	
	# For group therapy: auto-accept and create session immediately
	# For regular therapy: wait for patient acceptance
	if session_request.is_group_therapy:
		session_request.patient_choice = 'ACCEPTED'  # Auto-accept for group therapy
		session_request.patient_accepted_at = dj_tz.now()
	else:
		session_request.patient_choice = 'PENDING'  # Wait for patient acceptance
	
	session_request.save()
	
	channel_layer = get_channel_layer()
	therapy_session = None
	
	# For group therapy: create session immediately
	if session_request.is_group_therapy:
		# Refresh from database to ensure we have the latest patients
		session_request.refresh_from_db()
		all_patients = list(session_request.patients.all())
		logger.info(f"Group therapy request {session_request.id}: Found {len(all_patients)} patients")
		
		if not all_patients:
			logger.warning(f"Group therapy request {session_request.id} has no patients in ManyToMany! Using primary patient as fallback.")
			# Fallback: use primary patient if ManyToMany is empty
			if session_request.patient:
				all_patients = [session_request.patient]
		
		# Create therapy session immediately for group therapy
		therapy_session, created = TherapySession.objects.get_or_create(
			session_request=session_request,
			defaults={
				'patient': all_patients[0] if all_patients else None,
				'therapist': request.user,
				'is_active': True,
				'is_group_therapy': True
			}
		)
		if created:
			therapy_session.patients.set(all_patients)
		else:
			# Update patients list if session already exists
			therapy_session.patients.set(all_patients)
		
		# Send push notifications to all patients
		from .services import PushNotificationService
		from .serializers import TherapistProfileSerializer
		
		try:
			therapist_profile = TherapistProfile.objects.get(user=request.user, is_approved=True)
			therapist_serializer = TherapistProfileSerializer(therapist_profile, context={'request': request})
			therapist_name = therapist_profile.get_full_name()
		except TherapistProfile.DoesNotExist:
			therapist_name = request.user.username
		
		# Send push notification to each patient
		notification_service = PushNotificationService()
		for patient in all_patients:
			notification_service.send_notification_to_user(
				user=patient,
				title='جلسه درمانی گروهی شروع شد',
				message=f'جلسه درمانی گروهی شما با {therapist_name} شروع شد. می‌توانید چت را شروع کنید.',
				data={
					'type': 'group_therapy_started',
					'session_request_id': session_request.id,
					'therapy_session_id': therapy_session.id,
					'is_group_therapy': True,
					'patients_count': len(all_patients),
				},
				sent_by=request.user
			)
		
		# Send WebSocket notifications
		if channel_layer:
			serializer = SessionRequestSerializer(session_request, context={'request': request})
			therapy_serializer = TherapySessionSerializer(therapy_session, context={'request': request})
			
			# Notify all patients via WebSocket
			for patient in all_patients:
				async_to_sync(channel_layer.group_send)(
					f'patient_{patient.id}_notifications',
					{
						'type': 'group_therapy_session_started',
						'message': f'جلسه درمانی گروهی با {therapist_name} شروع شد. می‌توانید چت را شروع کنید.',
						'data': {
							'session_request': serializer.data,
							'therapy_session': therapy_serializer.data,
							'is_group_therapy': True,
							'patients_count': len(all_patients),
						}
					}
				)
			
			# Notify chat session group
			async_to_sync(channel_layer.group_send)(
				f'chat_session_{therapy_session.id}',
				{
					'type': 'session_started',
					'data': therapy_serializer.data
				}
			)
		
		# Send update to all therapists via WebSocket
		if channel_layer:
			serializer = SessionRequestSerializer(session_request, context={'request': request})
			async_to_sync(channel_layer.group_send)(
				'therapist_requests',
				{
					'type': 'request_updated',
					'data': serializer.data
				}
			)
		
		return Response({
			"success": True,
			"message": f"درخواست گروه درمانی با {len(all_patients)} بیمار تایید شد و جلسه درمانی شروع شد",
			"data": SessionRequestSerializer(session_request, context={'request': request}).data,
			"therapy_session_id": therapy_session.id,
			"is_group_therapy": True
		})
	else:
		# Regular therapy - single patient (existing logic)
		if channel_layer:
			serializer = SessionRequestSerializer(session_request, context={'request': request})
			
			# Send update to all therapists via WebSocket
			async_to_sync(channel_layer.group_send)(
				'therapist_requests',
				{
					'type': 'request_updated',
					'data': serializer.data
				}
			)
			
			# Send notification to patient with therapist profile
			from .serializers import TherapistProfileSerializer
			try:
				therapist_profile = TherapistProfile.objects.get(user=request.user, is_approved=True)
				therapist_serializer = TherapistProfileSerializer(therapist_profile, context={'request': request})
				therapist_data = therapist_serializer.data
			except TherapistProfile.DoesNotExist:
				therapist_data = None
			
			# Regular therapy - single patient
			async_to_sync(channel_layer.group_send)(
				f'patient_{session_request.patient.id}_notifications',
				{
					'type': 'therapist_approved',
					'message': 'درخواست شما تایید شد. می‌توانید درمان را شروع کنید.',
					'data': {
						'session_request': serializer.data,
						'therapist_profile': therapist_data,
						'is_group_therapy': False,
					}
				}
			)
		
		return Response({
			"success": True,
			"message": "درخواست با موفقیت تایید شد",
			"data": SessionRequestSerializer(session_request, context={'request': request}).data
		})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def deny_session_request(request, request_id):
	"""رد درخواست جلسه توسط تراپیست"""
	try:
		session_request = SessionRequest.objects.select_for_update().get(
			id=request_id,
			status='PENDING'
		)
	except SessionRequest.DoesNotExist:
		return Response(
			{"detail": "درخواست یافت نشد یا قبلاً پردازش شده است"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	# Update request status
	session_request.status = 'DENIED'
	session_request.denied_by = request.user
	
	# Release held funds (if any)
	if session_request.payment_status == 'HELD' and session_request.price > 0 and session_request.patient:
		_release_hold(session_request.patient, session_request.price, session_request, reason='رد درخواست توسط درمانگر')
		session_request.payment_status = 'RELEASED'
	
	session_request.save()
	
	# Send update to all therapists via WebSocket
	channel_layer = get_channel_layer()
	if channel_layer:
		serializer = SessionRequestSerializer(session_request)
		async_to_sync(channel_layer.group_send)(
			'therapist_requests',
			{
				'type': 'request_updated',
				'data': serializer.data
			}
		)
	
	return Response({
		"success": True,
		"message": "درخواست رد شد",
		"data": SessionRequestSerializer(session_request).data
	})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def therapist_requests_list(request):
	"""لیست درخواست‌های کاربران برای درمانگران"""
	responses = FormResponse.objects.all().select_related(
		'form', 'psychological_issue', 'user', 'user__profile'
	).prefetch_related('question_responses__question').order_by('-created_at')
	
	serializer = FormResponseRequestSerializer(responses, many=True)
	return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def therapist_request_detail(request, request_id):
	"""جزئیات یک درخواست خاص برای درمانگران"""
	try:
		response = FormResponse.objects.select_related(
			'form', 'psychological_issue', 'user', 'user__profile'
		).prefetch_related('question_responses__question').get(id=request_id)
	except FormResponse.DoesNotExist:
		return Response({"detail": "درخواست یافت نشد"}, status=status.HTTP_404_NOT_FOUND)
	
	serializer = FormResponseRequestSerializer(response)
	return Response(serializer.data)


# Therapist Profile Views
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_therapist_profile(request):
	"""دریافت پروفایل تراپیست (برای خود تراپیست)"""
	try:
		profile = TherapistProfile.objects.get(user=request.user)
		serializer = TherapistProfileSerializer(profile, context={'request': request})
		return Response(serializer.data)
	except TherapistProfile.DoesNotExist:
		return Response(
			{"detail": "پروفایل تراپیست یافت نشد. لطفاً ابتدا پروفایل خود را ایجاد کنید."},
			status=status.HTTP_404_NOT_FOUND
		)


@api_view(["POST", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def create_or_update_therapist_profile(request):
	"""ایجاد یا بروزرسانی پروفایل تراپیست"""
	profile, created = TherapistProfile.objects.get_or_create(user=request.user)
	profile_image_file = request.FILES.get('profile_image')
	print(
		f"[THERAPIST_PROFILE_UPDATE] user_id={request.user.id} method={request.method} "
		f"content_type={request.content_type} data_keys={list(request.data.keys())} "
		f"file_keys={list(request.FILES.keys())}",
		flush=True,
	)

	logger.info(
		"Therapist profile update request user_id=%s method=%s content_type=%s created=%s data_keys=%s file_keys=%s client_image_name=%s client_image_type=%s client_image_uri=%s",
		request.user.id,
		request.method,
		request.content_type,
		created,
		list(request.data.keys()),
		list(request.FILES.keys()),
		request.headers.get('X-Profile-Image-Name'),
		request.headers.get('X-Profile-Image-Type'),
		request.headers.get('X-Profile-Image-Uri'),
	)
	if profile_image_file:
		logger.info(
			"Therapist profile image upload user_id=%s file_name=%s file_size=%s file_content_type=%s",
			request.user.id,
			profile_image_file.name,
			getattr(profile_image_file, 'size', None),
			getattr(profile_image_file, 'content_type', None),
		)
	
	if request.method == 'POST':
		# Create new profile
		serializer = TherapistProfileUpdateSerializer(profile, data=request.data)
	elif request.method == 'PUT':
		# Full update
		serializer = TherapistProfileUpdateSerializer(profile, data=request.data)
	else:
		# Partial update (PATCH)
		serializer = TherapistProfileUpdateSerializer(profile, data=request.data, partial=True)
	
	if not serializer.is_valid():
		logger.warning(
			"Therapist profile serializer validation failed user_id=%s errors=%s",
			request.user.id,
			serializer.errors,
		)
		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

	previous_profile_image = profile.profile_image.name if profile.profile_image else None

	try:
		serializer.save()
	except Exception:
		logger.exception(
			"Therapist profile save failed user_id=%s previous_profile_image=%s has_uploaded_file=%s",
			request.user.id,
			previous_profile_image,
			bool(profile_image_file),
		)
		raise
	
	# Reset approval status if profile was updated (admin needs to re-approve)
	if not created:
		profile.is_approved = False
		profile.approved_by = None
		profile.approved_at = None
		profile.rejection_reason = None
		profile.save()
	
	# Return full profile
	profile.refresh_from_db()
	logger.info(
		"Therapist profile update success user_id=%s profile_id=%s previous_profile_image=%s current_profile_image=%s approved=%s",
		request.user.id,
		profile.id,
		previous_profile_image,
		profile.profile_image.name if profile.profile_image else None,
		profile.is_approved,
	)
	response_serializer = TherapistProfileSerializer(profile, context={'request': request})
	return Response(response_serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def list_approved_therapists(request):
	"""لیست تراپیست‌های تأیید شده (برای بیماران)"""
	therapists = TherapistProfile.objects.filter(is_approved=True).order_by('-approved_at', '-created_at')
	serializer = TherapistProfilePublicSerializer(therapists, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_therapist_profile_public(request, therapist_id):
	"""دریافت پروفایل عمومی یک تراپیست تأیید شده"""
	try:
		profile = TherapistProfile.objects.get(id=therapist_id, is_approved=True)
		serializer = TherapistProfilePublicSerializer(profile, context={'request': request})
		return Response(serializer.data)
	except TherapistProfile.DoesNotExist:
		return Response(
			{"detail": "تراپیست یافت نشد یا پروفایل تأیید نشده است"},
			status=status.HTTP_404_NOT_FOUND
		)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def accept_therapist(request, request_id):
	"""تایید تراپیست توسط بیمار"""
	try:
		session_request = SessionRequest.objects.select_for_update().prefetch_related('patients').get(
			id=request_id,
			status='APPROVED'
		)
		
		# For group therapy, session is already created and auto-accepted
		if session_request.is_group_therapy:
			# Check if user is a patient in this request
			if request.user not in session_request.patients.all():
				return Response(
					{"detail": "شما در این درخواست گروهی نیستید"},
					status=status.HTTP_403_FORBIDDEN
				)
			
			# Session should already exist from approve_session_request
			try:
				therapy_session = TherapySession.objects.get(session_request=session_request)
				serializer = TherapySessionSerializer(therapy_session, context={'request': request})
				return Response({
					"success": True,
					"message": "جلسه درمانی گروهی از قبل شروع شده است",
					"data": serializer.data
				})
			except TherapySession.DoesNotExist:
				# Fallback: create session if it doesn't exist (shouldn't happen)
				logger.warning(f"Therapy session not found for group therapy request {request_id}, creating fallback")
				all_patients = list(session_request.patients.all())
				therapy_session = TherapySession.objects.create(
					session_request=session_request,
					patient=all_patients[0] if all_patients else None,
					therapist=session_request.approved_by,
					is_active=True,
					is_group_therapy=True
				)
				therapy_session.patients.set(all_patients)
				serializer = TherapySessionSerializer(therapy_session, context={'request': request})
				return Response({
					"success": True,
					"message": "جلسه درمانی گروهی ایجاد شد",
					"data": serializer.data
				})
		
		# Regular therapy - check patient_choice
		if session_request.patient_choice != 'PENDING':
			return Response(
				{"detail": "این درخواست قبلاً پردازش شده است"},
				status=status.HTTP_400_BAD_REQUEST
			)
		
		# Check if user is the patient
		if session_request.patient != request.user:
			return Response(
				{"detail": "شما دسترسی به این درخواست ندارید"},
				status=status.HTTP_403_FORBIDDEN
			)
	except SessionRequest.DoesNotExist:
		return Response(
			{"detail": "درخواست یافت نشد یا قبلاً پردازش شده است"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	from django.utils import timezone
	from django.db.models import Q
	
	# Regular therapy - single patient (group therapy already handled above)
	# Mark as accepted
	session_request.patient_choice = 'ACCEPTED'
	session_request.patient_accepted_at = timezone.now()
	session_request.save()
	
	# Create therapy session if it doesn't exist
	therapy_session, created = TherapySession.objects.get_or_create(
		session_request=session_request,
		defaults={
			'patient': session_request.patient,
			'therapist': session_request.approved_by,
			'is_active': True,
			'is_group_therapy': False
		}
	)
	if created:
		therapy_session.patients.add(session_request.patient)
	
	# Transfer held funds to therapist when patient accepts
	if session_request.payment_status == 'HELD':
		try:
			_transfer_to_therapist(session_request)
		except ValueError as exc:
			return Response(
				{"detail": f"خطا در انتقال مبلغ: {str(exc)}"},
				status=status.HTTP_400_BAD_REQUEST
			)
	
	# Send update via WebSocket
	channel_layer = get_channel_layer()
	if channel_layer:
		serializer = SessionRequestSerializer(session_request, context={'request': request})
		# Notify therapists
		async_to_sync(channel_layer.group_send)(
			'therapist_requests',
			{
				'type': 'request_updated',
				'data': serializer.data
			}
		)
		
		# Notify patient that session started (regular therapy only)
		therapy_serializer = TherapySessionSerializer(therapy_session, context={'request': request})
		async_to_sync(channel_layer.group_send)(
			f'patient_{session_request.patient.id}_notifications',
			{
				'type': 'therapy_session_started',
				'message': 'جلسه درمانی شروع شد. می‌توانید چت را شروع کنید.',
				'data': {
					'therapy_session': therapy_serializer.data,
					'is_group_therapy': False,
				}
			}
		)
		
		# Notify chat session group (for real-time chat updates)
		async_to_sync(channel_layer.group_send)(
			f'chat_session_{therapy_session.id}',
			{
				'type': 'session_started',
				'data': therapy_serializer.data
			}
		)
	
	return Response({
		"success": True,
		"message": "تراپیست با موفقیت تایید شد و جلسه درمانی شروع شد",
		"data": TherapySessionSerializer(therapy_session, context={'request': request}).data
	})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def reject_therapist(request, request_id):
	"""رد تراپیست توسط بیمار (بیمار می‌خواهد تراپیست دیگری را انتخاب کند)"""
	try:
		session_request = SessionRequest.objects.select_for_update().prefetch_related('patients').get(
			id=request_id,
			status='APPROVED',
			patient_choice='PENDING'
		)
		
		# Check if user is a patient in this request
		is_patient = False
		if session_request.is_group_therapy:
			is_patient = request.user in session_request.patients.all()
		else:
			is_patient = session_request.patient == request.user
		
		if not is_patient:
			return Response(
				{"detail": "شما دسترسی به این درخواست ندارید"},
				status=status.HTTP_403_FORBIDDEN
			)
	except SessionRequest.DoesNotExist:
		return Response(
			{"detail": "درخواست یافت نشد یا قبلاً پردازش شده است"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	session_request.patient_choice = 'REJECTED'
	session_request.status = 'PENDING'  # Reset to pending so other therapists can see it
	session_request.approved_by = None
	session_request.save()
	
	# Send update via WebSocket
	channel_layer = get_channel_layer()
	if channel_layer:
		serializer = SessionRequestSerializer(session_request)
		# Notify therapists
		async_to_sync(channel_layer.group_send)(
			'therapist_requests',
			{
				'type': 'request_updated',
				'data': serializer.data
			}
		)
	
	return Response({
		"success": True,
		"message": "درخواست برای بررسی تراپیست‌های دیگر بازگشت",
		"data": SessionRequestSerializer(session_request).data
	})


# Chat Views
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_therapy_session(request, session_id):
	"""دریافت اطلاعات جلسه درمانی"""
	try:
		therapy_session = TherapySession.objects.select_related(
			'patient', 'therapist', 'session_request',
			'patient__profile', 'therapist__therapist_profile'
		).prefetch_related(
			'patients', 'patients__profile'
		).get(
			id=session_id
		)
		
		# Check if user is patient or therapist
		is_patient = False
		if therapy_session.is_group_therapy:
			is_patient = request.user in therapy_session.patients.all()
		else:
			is_patient = therapy_session.patient == request.user
		
		if not is_patient and therapy_session.therapist != request.user:
			return Response(
				{"detail": "شما دسترسی به این جلسه ندارید"},
				status=status.HTTP_403_FORBIDDEN
			)
	except TherapySession.DoesNotExist:
		return Response(
			{"detail": "جلسه درمانی یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	serializer = TherapySessionSerializer(therapy_session, context={'request': request})
	return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_therapy_session_by_request(request, request_id):
	"""دریافت جلسه درمانی بر اساس session request"""
	try:
		session_request = SessionRequest.objects.prefetch_related('patients').get(id=request_id)
		
		# Check if user is patient or therapist
		is_patient = False
		if session_request.is_group_therapy:
			# For group therapy, check if user is in patients ManyToMany
			is_patient = request.user in session_request.patients.all()
		else:
			# Regular therapy - check primary patient
			is_patient = session_request.patient == request.user
		
		is_therapist = session_request.approved_by == request.user
		
		if not is_patient and not is_therapist:
			return Response(
				{"detail": "شما دسترسی به این درخواست ندارید"},
				status=status.HTTP_403_FORBIDDEN
			)
		
		# Check if session exists
		if not hasattr(session_request, 'therapy_session'):
			return Response(
				{"detail": "جلسه درمانی هنوز ایجاد نشده است"},
				status=status.HTTP_404_NOT_FOUND
			)
		
		therapy_session = session_request.therapy_session
		# Prefetch related data for serializer
		therapy_session = TherapySession.objects.select_related(
			'patient', 'therapist', 'session_request',
			'patient__profile', 'therapist__therapist_profile'
		).prefetch_related(
			'patients', 'patients__profile'
		).get(id=therapy_session.id)
		serializer = TherapySessionSerializer(therapy_session, context={'request': request})
		return Response(serializer.data)
		
	except SessionRequest.DoesNotExist:
		return Response(
			{"detail": "درخواست یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_chat_messages(request, session_id):
	"""لیست پیام‌های چت یک جلسه درمانی"""
	try:
		therapy_session = TherapySession.objects.prefetch_related('patients').get(id=session_id)
		
		# Check if user is patient or therapist
		is_patient = False
		if therapy_session.is_group_therapy:
			is_patient = request.user in therapy_session.patients.all()
		else:
			is_patient = therapy_session.patient == request.user
		
		if not is_patient and therapy_session.therapist != request.user:
			return Response(
				{"detail": "شما دسترسی به این جلسه ندارید"},
				status=status.HTTP_403_FORBIDDEN
			)
	except TherapySession.DoesNotExist:
		return Response(
			{"detail": "جلسه درمانی یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	messages = therapy_session.chat_messages.all().select_related('sender')
	serializer = ChatMessageSerializer(messages, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def send_chat_message(request, session_id):
	"""ارسال پیام در چت"""
	try:
		therapy_session = TherapySession.objects.prefetch_related('patients').get(id=session_id)
		
		# Check if user is patient or therapist
		is_patient = False
		if therapy_session.is_group_therapy:
			is_patient = request.user in therapy_session.patients.all()
		else:
			is_patient = therapy_session.patient == request.user
		
		if not is_patient and therapy_session.therapist != request.user:
			return Response(
				{"detail": "شما دسترسی به این جلسه ندارید"},
				status=status.HTTP_403_FORBIDDEN
			)
		
		# Check if session is active
		if not therapy_session.is_active:
			return Response(
				{"detail": "این جلسه درمانی بسته شده است"},
				status=status.HTTP_400_BAD_REQUEST
			)
	except TherapySession.DoesNotExist:
		return Response(
			{"detail": "جلسه درمانی یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	# Validate message data
	message_type = request.data.get('message_type', 'TEXT')
	content = request.data.get('content', '').strip()
	voice_file = request.FILES.get('voice_file', None)
	
	# Validate based on message type
	if message_type == 'VOICE':
		if not voice_file:
			return Response(
				{"detail": "فایل صوتی الزامی است"},
				status=status.HTTP_400_BAD_REQUEST
			)
		# Content can be empty for voice messages, or contain a description
		if not content:
			content = 'پیام صوتی'
	else:
		if not content:
			return Response(
				{"detail": "متن پیام نمی‌تواند خالی باشد"},
				status=status.HTTP_400_BAD_REQUEST
			)
	
	# Create message with error handling for file upload
	try:
		chat_message = ChatMessage.objects.create(
			session=therapy_session,
			sender=request.user,
			message_type=message_type,
			content=content,
			voice_file=voice_file,
			is_read=False
		)
	except Exception as e:
		# Handle storage errors (e.g., Liara bucket access issues)
		error_detail = str(e)
		if '403' in error_detail or 'Forbidden' in error_detail:
			return Response(
				{
					"detail": "خطا در آپلود فایل به ذخیره‌سازی ابری. دسترسی به bucket رد شد. کلیدهای دسترسی را بررسی کنید.",
					"error": error_detail,
					"bucket_name": settings.AWS_STORAGE_BUCKET_NAME,
					"debug_info": str(e).split('\n') if hasattr(e, '__traceback__') else []
				},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR
			)
		return Response(
			{
				"detail": f"خطا در آپلود فایل: {error_detail}",
				"error": error_detail
			},
			status=status.HTTP_500_INTERNAL_SERVER_ERROR
		)
	
	# Send via WebSocket
	channel_layer = get_channel_layer()
	if channel_layer:
		serializer = ChatMessageSerializer(chat_message, context={'request': request})
		async_to_sync(channel_layer.group_send)(
			f'chat_session_{session_id}',
			{
				'type': 'chat_message',
				'data': serializer.data
			}
		)
	
	serializer = ChatMessageSerializer(chat_message, context={'request': request})
	return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mark_messages_as_read(request, session_id):
	"""علامت‌گذاری پیام‌ها به عنوان خوانده شده"""
	try:
		therapy_session = TherapySession.objects.prefetch_related('patients').get(id=session_id)
		
		# Check if user is patient or therapist
		is_patient = False
		if therapy_session.is_group_therapy:
			is_patient = request.user in therapy_session.patients.all()
		else:
			is_patient = therapy_session.patient == request.user
		
		if not is_patient and therapy_session.therapist != request.user:
			return Response(
				{"detail": "شما دسترسی به این جلسه ندارید"},
				status=status.HTTP_403_FORBIDDEN
			)
	except TherapySession.DoesNotExist:
		return Response(
			{"detail": "جلسه درمانی یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	# Mark all messages from other user as read
	from django.db.models import Q
	updated = therapy_session.chat_messages.filter(
		~Q(sender_id=request.user.id),
		is_read=False
	).update(is_read=True)
	
	return Response({
		"success": True,
		"message": f"{updated} پیام به عنوان خوانده شده علامت‌گذاری شد",
		"updated_count": updated
	})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def end_therapy_session(request, session_id):
	"""پایان دادن به جلسه درمانی توسط درمانگر"""
	try:
		therapy_session = TherapySession.objects.select_related(
			'session_request', 'therapist'
		).prefetch_related('patients').get(id=session_id)
		if therapy_session.therapist != request.user:
			return Response(
				{"detail": "فقط درمانگر می‌تواند جلسه را پایان دهد."},
				status=status.HTTP_403_FORBIDDEN
			)
		if not therapy_session.is_active:
			return Response(
				{"detail": "این جلسه قبلاً پایان یافته است."},
				status=status.HTTP_400_BAD_REQUEST
			)
		time_now = dj_tz.now()
		therapy_session.is_active = False
		therapy_session.ended_at = time_now
		therapy_session.save(update_fields=['is_active', 'ended_at'])

		serializer = TherapySessionSerializer(therapy_session, context={'request': request})
		channel_layer = get_channel_layer()
		if channel_layer:
			async_to_sync(channel_layer.group_send)(
				f'chat_session_{session_id}',
				{
					'type': 'session_ended',
					'data': serializer.data,
				}
			)
		return Response({
			"success": True,
			"message": "جلسه با موفقیت پایان یافت",
			"data": serializer.data
		})
	except TherapySession.DoesNotExist:
		return Response(
			{"detail": "جلسه درمانی یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_support_messages(request):
	"""لیست پیام‌های پشتیبانی کاربر"""
	messages = SupportChat.objects.filter(user=request.user).select_related('sender').order_by('created_at')
	serializer = SupportChatSerializer(messages, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def send_support_message(request):
	"""ارسال پیام در چت پشتیبانی"""
	# Validate message data
	message_type = request.data.get('message_type', 'TEXT')
	content = request.data.get('content', '').strip()
	voice_file = request.FILES.get('voice_file', None)
	
	# Validate based on message type
	if message_type == 'VOICE':
		if not voice_file:
			return Response(
				{"detail": "فایل صوتی الزامی است"},
				status=status.HTTP_400_BAD_REQUEST
			)
		# Content can be empty for voice messages, or contain a description
		if not content:
			content = 'پیام صوتی'
	else:
		if not content:
			return Response(
				{"detail": "متن پیام نمی‌تواند خالی باشد"},
				status=status.HTTP_400_BAD_REQUEST
			)
	
	# Create message with error handling for file upload
	try:
		support_message = SupportChat.objects.create(
			user=request.user,
			sender=request.user,
			is_support_staff=False,  # User messages are not from support staff
			message_type=message_type,
			content=content,
			voice_file=voice_file,
			is_read=False
		)
	except Exception as e:
		# Handle storage errors (e.g., Liara bucket access issues)
		error_detail = str(e)
		if '403' in error_detail or 'Forbidden' in error_detail:
			return Response(
				{
					"detail": "خطا در آپلود فایل به ذخیره‌سازی ابری. دسترسی به bucket رد شد. کلیدهای دسترسی را بررسی کنید.",
					"error": error_detail,
					"bucket_name": settings.AWS_STORAGE_BUCKET_NAME,
					"debug_info": str(e).split('\n') if hasattr(e, '__traceback__') else []
				},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR
			)
		return Response(
			{
				"detail": f"خطا در آپلود فایل: {error_detail}",
				"error": error_detail
			},
			status=status.HTTP_500_INTERNAL_SERVER_ERROR
		)
	
	# Send via WebSocket
	channel_layer = get_channel_layer()
	if channel_layer:
		serializer = SupportChatSerializer(support_message, context={'request': request})
		async_to_sync(channel_layer.group_send)(
			f'support_chat_{request.user.id}',
			{
				'type': 'support_message',
				'data': serializer.data
			}
		)
	
	serializer = SupportChatSerializer(support_message, context={'request': request})
	return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def mark_support_messages_as_read(request):
	"""علامت‌گذاری پیام‌های پشتیبانی به عنوان خوانده شده"""
	# Mark all messages from support staff as read
	from django.db.models import Q
	updated = SupportChat.objects.filter(
		Q(user=request.user) & ~Q(sender_id=request.user.id) & Q(is_read=False)
	).update(is_read=True)
	
	return Response({
		"success": True,
		"message": f"{updated} پیام به عنوان خوانده شده علامت‌گذاری شد",
		"updated_count": updated
	})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_support_chat_users(request):
	"""لیست کاربرانی که با پشتیبانی چت کرده‌اند (فقط برای کارمندان پشتیبانی)"""
	# Check if user is staff/superuser
	if not (request.user.is_staff or request.user.is_superuser):
		return Response(
			{"detail": "شما دسترسی به این بخش ندارید"},
			status=status.HTTP_403_FORBIDDEN
		)
	
	# Get distinct users who have support messages
	from django.db.models import Count, Max, Q
	users_with_chats = SupportChat.objects.values(
		'user__id', 'user__username'
	).annotate(
		total_messages=Count('id'),
		unread_count=Count('id', filter=Q(is_read=False, is_support_staff=False)),
		last_message_at=Max('created_at')
	).order_by('-last_message_at')
	
	# Get user profiles
	from .models import UserProfile
	user_list = []
	for user_data in users_with_chats:
		user_id = user_data['user__id']
		try:
			profile = UserProfile.objects.get(user_id=user_id)
			user_name = f"{profile.first_name} {profile.last_name}".strip() if profile.first_name or profile.last_name else user_data['user__username']
		except UserProfile.DoesNotExist:
			user_name = user_data['user__username']
		
		user_list.append({
			'user_id': user_id,
			'username': user_data['user__username'],
			'name': user_name,
			'total_messages': user_data['total_messages'],
			'unread_count': user_data['unread_count'],
			'last_message_at': user_data['last_message_at'],
		})
	
	return Response(user_list)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_support_chat_for_user(request, user_id):
	"""دریافت تمام پیام‌های چت پشتیبانی برای یک کاربر خاص (فقط برای کارمندان پشتیبانی)"""
	# Check if user is staff/superuser
	if not (request.user.is_staff or request.user.is_superuser):
		return Response(
			{"detail": "شما دسترسی به این بخش ندارید"},
			status=status.HTTP_403_FORBIDDEN
		)
	
	# Get all messages for this user
	messages = SupportChat.objects.filter(user_id=user_id).select_related('sender', 'user').order_by('created_at')
	serializer = SupportChatSerializer(messages, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def send_support_staff_message(request, user_id):
	"""ارسال پیام از طرف پشتیبانی به کاربر (فقط برای کارمندان پشتیبانی)"""
	# Check if user is staff/superuser
	if not (request.user.is_staff or request.user.is_superuser):
		return Response(
			{"detail": "شما دسترسی به این بخش ندارید"},
			status=status.HTTP_403_FORBIDDEN
		)
	
	# Validate message data
	message_type = request.data.get('message_type', 'TEXT')
	content = request.data.get('content', '').strip()
	voice_file = request.FILES.get('voice_file', None)
	
	# Validate based on message type
	if message_type == 'VOICE':
		if not voice_file:
			return Response(
				{"detail": "فایل صوتی الزامی است"},
				status=status.HTTP_400_BAD_REQUEST
			)
		if not content:
			content = 'پیام صوتی'
	else:
		if not content:
			return Response(
				{"detail": "متن پیام نمی‌تواند خالی باشد"},
				status=status.HTTP_400_BAD_REQUEST
			)
	
	# Get target user
	from django.contrib.auth import get_user_model
	User = get_user_model()
	try:
		target_user = User.objects.get(id=user_id)
	except User.DoesNotExist:
		return Response(
			{"detail": "کاربر یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	# Create message with error handling for file upload
	try:
		support_message = SupportChat.objects.create(
			user=target_user,
			sender=request.user,
			is_support_staff=True,  # This is from support staff
			message_type=message_type,
			content=content,
			voice_file=voice_file,
			is_read=False
		)
	except Exception as e:
		# Handle storage errors
		error_detail = str(e)
		if '403' in error_detail or 'Forbidden' in error_detail:
			return Response(
				{
					"detail": "خطا در آپلود فایل به ذخیره‌سازی ابری. دسترسی به bucket رد شد.",
					"error": error_detail,
				},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR
			)
		return Response(
			{
				"detail": f"خطا در آپلود فایل: {error_detail}",
				"error": error_detail
			},
			status=status.HTTP_500_INTERNAL_SERVER_ERROR
		)
	
	# Send via WebSocket
	channel_layer = get_channel_layer()
	if channel_layer:
		serializer = SupportChatSerializer(support_message, context={'request': request})
		async_to_sync(channel_layer.group_send)(
			f'support_chat_{user_id}',
			{
				'type': 'support_message',
				'data': serializer.data
			}
		)
	
	serializer = SupportChatSerializer(support_message, context={'request': request})
	return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_my_therapy_sessions(request):
	"""لیست جلسات درمانی کاربر"""
	# Get sessions where user is therapist, primary patient, or in patients ManyToMany
	sessions = TherapySession.objects.filter(
		models.Q(patient=request.user) | 
		models.Q(therapist=request.user) |
		models.Q(patients=request.user)
	).select_related(
		'patient', 'therapist', 'therapist__therapist_profile', 'session_request',
	).prefetch_related('patients').distinct().order_by('-started_at')
	
	serializer = TherapySessionSerializer(sessions, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_jitsi_room(request, session_id):
	"""دریافت نام اتاق Jitsi برای جلسه درمانی"""
	try:
		therapy_session = TherapySession.objects.prefetch_related('patients').get(id=session_id)
		
		# Check if user is patient or therapist
		is_patient = False
		if therapy_session.is_group_therapy:
			is_patient = request.user in therapy_session.patients.all()
		else:
			is_patient = therapy_session.patient == request.user
		
		if not is_patient and therapy_session.therapist != request.user:
			return Response(
				{"detail": "شما دسترسی به این جلسه ندارید"},
				status=status.HTTP_403_FORBIDDEN
			)
		
		# Generate deterministic room name based on session ID
		# Format: therapy-session-{session_id}-{hash}
		import hashlib
		room_seed = f"therapy-session-{session_id}"
		room_hash = hashlib.md5(room_seed.encode()).hexdigest()[:8]
		room_name = f"therapy-session-{session_id}-{room_hash}"
		
		# Use Jitsi public server
		server_url = "https://meet.jit.si"
		
		return Response({
			"room_name": room_name,
			"server_url": server_url,
			"session_id": session_id
		})
		
	except TherapySession.DoesNotExist:
		return Response(
			{"detail": "جلسه درمانی یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)


# Post Views
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def create_post(request):
	"""ایجاد پست توسط تراپیست"""
	# Check if user is a therapist
	try:
		therapist_profile = TherapistProfile.objects.get(user=request.user, is_approved=True)
	except TherapistProfile.DoesNotExist:
		return Response(
			{"detail": "فقط تراپیست‌های تأیید شده می‌توانند پست ایجاد کنند"},
			status=status.HTTP_403_FORBIDDEN
		)
	
	serializer = PostCreateSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	
	# Create post
	post = Post.objects.create(
		therapist=request.user,
		**serializer.validated_data
	)
	
	# Return created post
	response_serializer = PostSerializer(post, context={'request': request})
	return Response(response_serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_posts(request):
	"""لیست پست‌های فعال (برای همه کاربران)"""
	posts = Post.objects.filter(is_active=True).select_related(
		'therapist', 'therapist__therapist_profile'
	).prefetch_related('reactions').order_by('-created_at')
	
	serializer = PostSerializer(posts, many=True, context={'request': request})
	return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_post_detail(request, post_id):
	"""جزئیات یک پست"""
	try:
		post = Post.objects.select_related(
			'therapist', 'therapist__therapist_profile'
		).prefetch_related('reactions').get(id=post_id, is_active=True)
	except Post.DoesNotExist:
		return Response(
			{"detail": "پست یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	serializer = PostSerializer(post, context={'request': request})
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def add_or_update_reaction(request, post_id):
	"""افزودن یا بروزرسانی واکنش به پست"""
	try:
		post = Post.objects.get(id=post_id, is_active=True)
	except Post.DoesNotExist:
		return Response(
			{"detail": "پست یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	serializer = PostReactionCreateSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	
	reaction_type = serializer.validated_data['reaction_type']
	
	# Create or update reaction (unique_together ensures one reaction per user per post)
	reaction, created = PostReaction.objects.update_or_create(
		post=post,
		user=request.user,
		defaults={'reaction_type': reaction_type}
	)
	
	response_serializer = PostReactionSerializer(reaction)
	return Response(
		{
			"success": True,
			"message": "واکنش با موفقیت ثبت شد" if created else "واکنش با موفقیت بروزرسانی شد",
			"reaction": response_serializer.data
		},
		status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
	)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
@transaction.atomic
def remove_reaction(request, post_id):
	"""حذف واکنش از پست"""
	try:
		post = Post.objects.get(id=post_id, is_active=True)
	except Post.DoesNotExist:
		return Response(
			{"detail": "پست یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	try:
		reaction = PostReaction.objects.get(post=post, user=request.user)
		reaction.delete()
		return Response(
			{
				"success": True,
				"message": "واکنش با موفقیت حذف شد"
			},
			status=status.HTTP_200_OK
		)
	except PostReaction.DoesNotExist:
		return Response(
			{"detail": "واکنش یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_post_reactions(request, post_id):
	"""لیست واکنش‌های یک پست"""
	try:
		post = Post.objects.get(id=post_id, is_active=True)
	except Post.DoesNotExist:
		return Response(
			{"detail": "پست یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)
	
	reactions = post.reactions.all().select_related('user', 'user__profile', 'user__therapist_profile')
	serializer = PostReactionSerializer(reactions, many=True, context={'request': request})
	return Response(serializer.data)


# Device Token and Notification Views
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_device_token(request):
	"""ثبت توکن دستگاه برای دریافت نوتیفیکیشن"""
	serializer = DeviceTokenRegisterSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	
	token = serializer.validated_data['token']
	device_type = serializer.validated_data['device_type']
	device_name = serializer.validated_data.get('device_name', '')
	
	# ایجاد یا بروزرسانی توکن
	device_token, created = DeviceToken.objects.update_or_create(
		token=token,
		defaults={
			'user': request.user,
			'device_type': device_type,
			'device_name': device_name,
			'is_active': True
		}
	)
	
	response_serializer = DeviceTokenSerializer(device_token)
	return Response(
		{
			"success": True,
			"message": "توکن با موفقیت ثبت شد" if created else "توکن بروزرسانی شد",
			"device_token": response_serializer.data
		},
		status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
	)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def unregister_device_token(request, token_id):
	"""حذف توکن دستگاه"""
	try:
		device_token = DeviceToken.objects.get(id=token_id, user=request.user)
		device_token.is_active = False
		device_token.save()
		return Response(
			{
				"success": True,
				"message": "توکن با موفقیت حذف شد"
			},
			status=status.HTTP_200_OK
		)
	except DeviceToken.DoesNotExist:
		return Response(
			{"detail": "توکن یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_notifications(request):
	"""لیست نوتیفیکیشن‌های کاربر"""
	notifications = Notification.objects.filter(user=request.user).order_by('-sent_at')
	serializer = NotificationSerializer(notifications, many=True)
	return Response(serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_notification_as_read(request, notification_id):
	"""علامت‌گذاری نوتیفیکیشن به عنوان خوانده شده"""
	try:
		notification = Notification.objects.get(id=notification_id, user=request.user)
		if not notification.is_read:
			notification.is_read = True
			notification.read_at = dj_tz.now()
			notification.save()
		serializer = NotificationSerializer(notification)
		return Response(serializer.data)
	except Notification.DoesNotExist:
		return Response(
			{"detail": "نوتیفیکیشن یافت نشد"},
			status=status.HTTP_404_NOT_FOUND
		)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_notifications_as_read(request):
	"""علامت‌گذاری همه نوتیفیکیشن‌ها به عنوان خوانده شده"""
	updated = Notification.objects.filter(
		user=request.user,
		is_read=False
	).update(is_read=True, read_at=dj_tz.now())
	
	return Response({
		"success": True,
		"message": f"{updated} نوتیفیکیشن به عنوان خوانده شده علامت‌گذاری شد",
		"updated_count": updated
	})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_notification(request):
	"""ارسال نوتیفیکیشن (فقط برای admin)"""
	if not request.user.is_superuser and not request.user.is_staff:
		return Response(
			{"detail": "شما دسترسی به این عملیات ندارید"},
			status=status.HTTP_403_FORBIDDEN
		)
	
	serializer = SendNotificationSerializer(data=request.data)
	serializer.is_valid(raise_exception=True)
	
	user_ids = serializer.validated_data['user_ids']
	title = serializer.validated_data['title']
	message = serializer.validated_data['message']
	user_type = serializer.validated_data.get('user_type', 'all')
	
	# دریافت کاربران
	users = User.objects.filter(id__in=user_ids)
	
	if user_type == 'patient':
		# فقط بیماران (کاربران بدون پروفایل تراپیست تأیید شده)
		users = users.exclude(therapist_profile__is_approved=True)
	elif user_type == 'therapist':
		# فقط تراپیست‌ها (کاربران با پروفایل تراپیست تأیید شده)
		users = users.filter(therapist_profile__is_approved=True)
	
	if not users.exists():
		return Response(
			{"detail": "هیچ کاربری یافت نشد"},
			status=status.HTTP_400_BAD_REQUEST
		)
	
	# ارسال نوتیفیکیشن
	from .services import PushNotificationService
	service = PushNotificationService()
	
	result = service.send_notification_to_multiple_users(
		users=list(users),
		title=title,
		message=message,
		sent_by=request.user
	)
	
	return Response({
		"success": result.get('success', False),
		"message": f"نوتیفیکیشن به {len(users)} کاربر ارسال شد",
		"users_count": len(users),
		"success_count": result.get('success_count', 0),
		"fail_count": result.get('fail_count', 0),
		"errors": result.get('errors', [])
	})


@api_view(["GET"])
@permission_classes([AllowAny])  # Allow access without authentication for testing
def camera_test_page(request):
	"""صفحه تست دوربین - برای تست getUserMedia در WebView"""
	html_content = """
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>تست دوربین Samsung A55</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff; 
            padding: 20px; 
            min-height: 100vh;
            text-align: center; 
        }
        .container { max-width: 100%; margin: 0 auto; }
        h1 { margin-bottom: 20px; font-size: 28px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .device-info { background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 14px; }
        .status { padding: 15px; margin: 10px 0; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
        .status.success { background: #10b981; color: #fff; }
        .status.error { background: #ef4444; color: #fff; }
        .status.info { background: #3b82f6; color: #fff; }
        .status.warning { background: #f59e0b; color: #fff; }
        video { width: 100%; max-width: 640px; height: auto; background: #1a1a1a; border: 3px solid #fff; border-radius: 12px; margin: 20px 0; box-shadow: 0 8px 16px rgba(0,0,0,0.3); transform: scaleX(-1); }
        button { background: #2563eb; color: #fff; border: none; padding: 18px 35px; font-size: 18px; border-radius: 12px; cursor: pointer; margin: 10px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3); transition: all 0.3s; }
        button:active { transform: scale(0.95); background: #1d4ed8; }
        button:disabled { background: #666; cursor: not-allowed; opacity: 0.6; }
        .info { margin: 20px 0; padding: 20px; background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; text-align: right; }
        .info-item { margin: 12px 0; padding: 8px 0; font-size: 16px; }
        .log { background: rgba(0,0,0,0.4); padding: 15px; border-radius: 12px; margin: 20px 0; max-height: 250px; overflow-y: auto; text-align: right; font-family: 'Courier New', monospace; font-size: 13px; }
        .log-item { margin: 6px 0; padding: 6px; border-radius: 4px; }
        .log-item.error { color: #fca5a5; background: rgba(239,68,68,0.2); }
        .log-item.success { color: #86efac; background: rgba(16,185,129,0.2); }
        .log-item.info { color: #93c5fd; }
        .button-group { display: flex; flex-direction: row; justify-content: center; flex-wrap: wrap; gap: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 تست دوربین Samsung A55</h1>
        <div class="device-info" id="deviceInfo">در حال شناسایی دستگاه...</div>
        <div id="status" class="status info">در حال بررسی...</div>
        <video id="video" autoplay playsinline muted></video>
        <div class="button-group">
            <button id="testBtn" onclick="testCamera()">🎥 تست دوربین</button>
            <button id="stopBtn" onclick="stopCamera()" disabled>⏹ توقف</button>
            <button id="switchBtn" onclick="switchCamera()" disabled>🔄 تعویض دوربین</button>
        </div>
        <div class="info">
            <div class="info-item"><strong>دوربین:</strong> <span id="cameraStatus">در حال بررسی...</span></div>
            <div class="info-item"><strong>میکروفون:</strong> <span id="micStatus">در حال بررسی...</span></div>
            <div class="info-item"><strong>دستگاه‌های موجود:</strong> <span id="devicesCount">0</span></div>
            <div class="info-item"><strong>رزولوشن:</strong> <span id="resolution">-</span></div>
        </div>
        <div class="log" id="log"><div class="log-item info">آماده برای تست...</div></div>
    </div>
    <script>
        const deviceInfo = document.getElementById('deviceInfo');
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Samsung') || userAgent.includes('SM-')) {
            deviceInfo.textContent = '✅ دستگاه Samsung شناسایی شد: ' + userAgent;
            deviceInfo.style.background = 'rgba(16,185,129,0.3)';
        } else {
            deviceInfo.textContent = '📱 دستگاه: ' + userAgent;
        }

        const video = document.getElementById('video');
        const statusDiv = document.getElementById('status');
        const cameraStatus = document.getElementById('cameraStatus');
        const micStatus = document.getElementById('micStatus');
        const devicesCount = document.getElementById('devicesCount');
        const resolution = document.getElementById('resolution');
        const logDiv = document.getElementById('log');
        const testBtn = document.getElementById('testBtn');
        const stopBtn = document.getElementById('stopBtn');
        const switchBtn = document.getElementById('switchBtn');
        
        let stream = null;
        let currentFacingMode = 'user';
        let availableDevices = [];
        
        function log(message, type = 'info') {
            const logItem = document.createElement('div');
            logItem.className = 'log-item ' + type;
            const time = new Date().toLocaleTimeString('fa-IR');
            logItem.textContent = '[' + time + '] ' + message;
            logDiv.appendChild(logItem);
            logDiv.scrollTop = logDiv.scrollHeight;
            console.log(message);
        }
        
        function updateStatus(message, type = 'info') {
            statusDiv.textContent = message;
            statusDiv.className = 'status ' + type;
        }
        
        async function checkDevices() {
            try {
                log('🔍 در حال بررسی دستگاه‌های موجود...', 'info');
                if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                    log('⚠️ enumerateDevices در دسترس نیست', 'error');
                    devicesCount.textContent = 'نامشخص';
                    return;
                }
                const devices = await navigator.mediaDevices.enumerateDevices();
                availableDevices = devices;
                const videoDevices = devices.filter(d => d.kind === 'videoinput');
                const audioDevices = devices.filter(d => d.kind === 'audioinput');
                
                devicesCount.textContent = videoDevices.length + ' دوربین، ' + audioDevices.length + ' میکروفون';
                log('✅ پیدا شد: ' + videoDevices.length + ' دوربین و ' + audioDevices.length + ' میکروفون', 'success');
                
                if (videoDevices.length > 0) {
                    cameraStatus.textContent = '✓ ' + videoDevices.length + ' دستگاه پیدا شد';
                    cameraStatus.style.color = '#10b981';
                    if (videoDevices.length > 1) {
                        switchBtn.disabled = false;
                    }
                } else {
                    cameraStatus.textContent = '✗ هیچ دوربینی پیدا نشد';
                    cameraStatus.style.color = '#ef4444';
                }
                
                if (audioDevices.length > 0) {
                    micStatus.textContent = '✓ ' + audioDevices.length + ' دستگاه پیدا شد';
                    micStatus.style.color = '#10b981';
                } else {
                    micStatus.textContent = '✗ هیچ میکروفونی پیدا نشد';
                    micStatus.style.color = '#ef4444';
                }
            } catch (error) {
                log('❌ خطا در بررسی دستگاه‌ها: ' + error.message, 'error');
            }
        }
        
        async function testCamera() {
            try {
                log('🚀 شروع تست دوربین و میکروفون...', 'info');
                
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    log('❌ خطا: getUserMedia موجود نیست', 'error');
                    updateStatus('✗ getUserMedia در دسترس نیست', 'error');
                    testBtn.disabled = false;
                    return;
                }
                
                updateStatus('⏳ در حال درخواست دسترسی...', 'info');
                testBtn.disabled = true;
                
                const constraints = {
                    video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
                    audio: true
                };
                
                log('📹 در حال فراخوانی getUserMedia...', 'info');
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                
                log('✅ دسترسی به دوربین و میکروفون دریافت شد!', 'success');
                updateStatus('✅ دوربین و میکروفون فعال هستند', 'success');
                
                video.srcObject = stream;
                
                const videoTracks = stream.getVideoTracks();
                const audioTracks = stream.getAudioTracks();
                
                if (videoTracks.length > 0) {
                    const track = videoTracks[0];
                    const settings = track.getSettings();
                    log('📹 دوربین فعال: ' + (track.label || 'دوربین ناشناس'), 'success');
                    log('📐 رزولوشن: ' + settings.width + 'x' + settings.height, 'success');
                    cameraStatus.textContent = '✓ فعال - ' + settings.width + 'x' + settings.height;
                    cameraStatus.style.color = '#10b981';
                    resolution.textContent = settings.width + 'x' + settings.height + ' @ ' + (settings.frameRate || '?') + 'fps';
                } else {
                    log('⚠️ هیچ دوربینی فعال نیست', 'error');
                    cameraStatus.textContent = '✗ فعال نیست';
                    cameraStatus.style.color = '#ef4444';
                }
                
                if (audioTracks.length > 0) {
                    const track = audioTracks[0];
                    log('🎤 میکروفون فعال: ' + (track.label || 'میکروفون ناشناس'), 'success');
                    micStatus.textContent = '✓ فعال';
                    micStatus.style.color = '#10b981';
                } else {
                    log('⚠️ هیچ میکروفونی فعال نیست', 'error');
                    micStatus.textContent = '✗ فعال نیست';
                    micStatus.style.color = '#ef4444';
                }
                
                stopBtn.disabled = false;
                if (availableDevices.filter(d => d.kind === 'videoinput').length > 1) {
                    switchBtn.disabled = false;
                }
                
            } catch (error) {
                log('❌ خطا: ' + error.name + ' - ' + error.message, 'error');
                
                if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                    updateStatus('✗ دسترسی رد شد. لطفاً مجوزها را در تنظیمات فعال کنید', 'error');
                    cameraStatus.textContent = '✗ دسترسی رد شد';
                    micStatus.textContent = '✗ دسترسی رد شد';
                } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                    updateStatus('✗ هیچ دوربین یا میکروفونی پیدا نشد', 'error');
                    cameraStatus.textContent = '✗ پیدا نشد';
                    micStatus.textContent = '✗ پیدا نشد';
                } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                    updateStatus('✗ دستگاه در حال استفاده است', 'error');
                } else {
                    updateStatus('✗ خطا: ' + error.message, 'error');
                }
                
                testBtn.disabled = false;
            }
        }
        
        async function switchCamera() {
            if (!stream) return;
            try {
                log('🔄 در حال تعویض دوربین...', 'info');
                stream.getTracks().forEach(track => track.stop());
                stream = null;
                video.srcObject = null;
                currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
                await testCamera();
            } catch (error) {
                log('❌ خطا در تعویض دوربین: ' + error.message, 'error');
            }
        }
        
        function stopCamera() {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
                video.srcObject = null;
                log('⏹ دوربین و میکروفون متوقف شدند', 'info');
                updateStatus('⏹ متوقف شد', 'info');
                testBtn.disabled = false;
                stopBtn.disabled = true;
                switchBtn.disabled = true;
                resolution.textContent = '-';
            }
        }
        
        // Check secure context
        function checkSecureContext() {
            const isSecure = window.isSecureContext || (location.protocol === 'https:') || (location.hostname === 'localhost') || (location.hostname === '127.0.0.1');
            const isDevTunnel = location.hostname.includes('devtunnels.ms') || location.hostname.includes('ngrok') || location.hostname.includes('tunnel');
            
            log('🔒 Secure Context Check:', isSecure ? 'success' : 'error');
            log('   - window.isSecureContext: ' + (window.isSecureContext ? 'true' : 'false'), isSecure ? 'success' : 'error');
            log('   - location.protocol: ' + location.protocol, isSecure ? 'success' : 'error');
            log('   - location.hostname: ' + location.hostname, isSecure ? 'success' : 'error');
            
            if (isDevTunnel) {
                log('⚠️ Dev Tunnel Detected: ' + location.hostname, 'info');
                log('💡 نکته: Dev tunnels ممکن است secure context را به درستی تشخیص ندهند', 'info');
                log('💡 راهکار 1: از ADB port forwarding استفاده کنید:', 'info');
                log('   adb reverse tcp:8000 tcp:8000', 'info');
                log('   سپس از http://localhost:8000 استفاده کنید', 'info');
                log('💡 راهکار 2: از IP محلی استفاده کنید (اگر در همان شبکه هستید)', 'info');
            }
            
            if (!isSecure) {
                log('⚠️ هشدار: این صفحه در یک secure context نیست. getUserMedia ممکن است کار نکند!', 'error');
                log('💡 راهکار: از HTTPS معتبر، localhost، یا 127.0.0.1 استفاده کنید', 'info');
            }
            return isSecure;
        }
        
        window.addEventListener('load', async () => {
            log('✅ صفحه تست بارگذاری شد', 'success');
            checkSecureContext();
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                log('✅ getUserMedia در دسترس است', 'success');
                await checkDevices();
                updateStatus('✅ آماده برای تست. روی دکمه "تست دوربین" کلیک کنید', 'info');
            } else {
                log('❌ getUserMedia در دسترس نیست', 'error');
                updateStatus('✗ getUserMedia در دسترس نیست', 'error');
            }
        });
    </script>
</body>
</html>
"""
	return HttpResponse(html_content, content_type='text/html; charset=utf-8')
