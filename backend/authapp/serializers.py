import ast
import json

from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Category, PsychologicalIssue, Form, Question, FormResponse, QuestionResponse, UserProfile, SessionRequest, TherapistOffer, TherapistProfile, TherapySession, ChatMessage, Post, PostReaction, DeviceToken, Notification, SupportChat, Wallet, WalletTransaction

User = get_user_model()
PUBLIC_FILE_DOMAIN = 'https://therapylane.ir'


def get_bucket_file_url(file_field):
	if not file_field:
		return None
	file_path = str(file_field.name).lstrip('/')
	if file_path.startswith('therapylane/'):
		file_path = file_path[len('therapylane/'):]
	return f'{PUBLIC_FILE_DOMAIN}/{file_path}'


class RequestOTPSerializer(serializers.Serializer):
	phone = serializers.CharField(min_length=8, max_length=20)

	def validate_phone(self, value: str) -> str:
		clean = "".join(ch for ch in value if ch.isdigit() or ch == "+")
		if len(clean) < 8:
			raise serializers.ValidationError("Invalid phone number")
		return clean


class VerifyOTPSerializer(serializers.Serializer):
	phone = serializers.CharField(min_length=8, max_length=20)
	otp = serializers.CharField(min_length=4, max_length=6)


class PsychologicalIssueSerializer(serializers.ModelSerializer):
	image_url = serializers.SerializerMethodField()
	has_form = serializers.SerializerMethodField()
	category = serializers.SerializerMethodField()
	category_id = serializers.SerializerMethodField()
	category_order = serializers.SerializerMethodField()
	
	class Meta:
		model = PsychologicalIssue
		fields = [
			'id', 'title', 'title_fa', 'description', 'category', 'category_id',
			'category_order', 'order', 'image', 'image_url', 'is_active', 'has_form',
			'created_at', 'updated_at',
		]
	
	def get_category(self, obj):
		"""Return category name (for backward compatibility with frontend expecting string)"""
		if obj.category:
			return obj.category.name_fa or obj.category.name
		return None

	def get_category_id(self, obj):
		return obj.category_id

	def get_category_order(self, obj):
		if obj.category:
			return obj.category.order
		return 9999
	
	def get_image_url(self, obj):
		if obj.image:
			# Filter out broken image URLs
			image_url_str = str(obj.image.url)
			if 'photo_2024-10-30_20-27-51' in image_url_str:
				return None
			return get_bucket_file_url(obj.image)
		return None

	def get_has_form(self, obj):
		return hasattr(obj, 'form') and obj.form is not None and obj.form.is_active


class QuestionSerializer(serializers.ModelSerializer):
	options_list = serializers.SerializerMethodField()
	
	class Meta:
		model = Question
		fields = ['id', 'text', 'text_fa', 'question_type', 'options', 'options_fa', 'options_list', 'is_required', 'is_active', 'order']
	
	def get_options_list(self, obj):
		return obj.get_options_list()


class FormSerializer(serializers.ModelSerializer):
	questions = serializers.SerializerMethodField()
	
	class Meta:
		model = Form
		fields = ['id', 'title', 'title_fa', 'description', 'session_price', 'is_active', 'group_therapy_enabled', 'group_therapy_max_patients', 'questions', 'created_at', 'updated_at']
	
	def get_questions(self, obj):
		questions = obj.questions.filter(is_active=True).order_by('order', 'id')
		return QuestionSerializer(questions, many=True).data


class QuestionResponseSerializer(serializers.Serializer):
	question_id = serializers.IntegerField()
	answer_text = serializers.CharField(required=False, allow_blank=True, allow_null=True)
	answer_number = serializers.FloatField(required=False, allow_null=True)
	answer_boolean = serializers.BooleanField(required=False, allow_null=True)


class FormResponseSubmitSerializer(serializers.Serializer):
	psychological_issue_id = serializers.IntegerField()
	answers = QuestionResponseSerializer(many=True)
	is_group_therapy = serializers.BooleanField(default=False, required=False)
	
	def validate(self, data):
		# Check if issue exists and has an active form
		try:
			issue = PsychologicalIssue.objects.get(id=data['psychological_issue_id'], is_active=True)
			if not hasattr(issue, 'form') or not issue.form.is_active:
				raise serializers.ValidationError("این مسئله فرم فعالی ندارد")
			
			# Validate group therapy option
			is_group_therapy = data.get('is_group_therapy', False)
			if is_group_therapy and not issue.form.group_therapy_enabled:
				raise serializers.ValidationError("این فرم درمان گروهی را پشتیبانی نمی‌کند")
		except PsychologicalIssue.DoesNotExist:
			raise serializers.ValidationError("مسئله یافت نشد")
		
		# Validate answers against questions
		form = issue.form
		questions = form.questions.filter(is_active=True).order_by('order', 'id')
		question_ids = set(questions.values_list('id', flat=True))
		answer_question_ids = {answer['question_id'] for answer in data['answers']}
		
		# Check for required questions
		for question in questions:
			if question.is_required and question.id not in answer_question_ids:
				raise serializers.ValidationError(f"سوال اجباری پاسخ داده نشده: {question.text_fa or question.text}")
		
		# Validate answer formats
		for answer_data in data['answers']:
			question_id = answer_data['question_id']
			if question_id not in question_ids:
				raise serializers.ValidationError(f"سوال نامعتبر: {question_id}")
			
			question = questions.get(id=question_id)
			
			# Validate based on question type
			if question.question_type == 'yes_no':
				if answer_data.get('answer_boolean') is None:
					raise serializers.ValidationError(f"پاسخ سوال {question.text_fa or question.text} باید بله یا خیر باشد")
			elif question.question_type == 'number':
				if answer_data.get('answer_number') is None:
					raise serializers.ValidationError(f"پاسخ سوال {question.text_fa or question.text} باید عدد باشد")
			else:
				if not answer_data.get('answer_text'):
					if question.is_required:
						raise serializers.ValidationError(f"پاسخ سوال {question.text_fa or question.text} اجباری است")
		
		return data


class UserProfileSerializer(serializers.ModelSerializer):
	user_id = serializers.IntegerField(source='user.id', read_only=True)
	phone = serializers.CharField(source='user.username', read_only=True)
	is_complete = serializers.SerializerMethodField()
	missing_fields = serializers.SerializerMethodField()
	
	class Meta:
		model = UserProfile
		fields = [
			'id', 'user_id', 'phone', 'first_name', 'last_name', 'date_of_birth',
			'gender', 'email', 'address', 'city', 'is_complete', 'missing_fields',
			'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at']
	
	def get_is_complete(self, obj):
		if obj:
			return obj.is_complete()
		return False
	
	def get_missing_fields(self, obj):
		if obj:
			return obj.get_missing_fields()
		return ['نام', 'نام خانوادگی', 'تاریخ تولد', 'جنسیت']
	
	def validate_date_of_birth(self, value):
		"""اعتبارسنجی تاریخ تولد"""
		from datetime import date
		if value and value > date.today():
			raise serializers.ValidationError("تاریخ تولد نمی‌تواند در آینده باشد")
		return value


class UserProfileUpdateSerializer(serializers.ModelSerializer):
	class Meta:
		model = UserProfile
		fields = [
			'first_name', 'last_name', 'date_of_birth',
			'gender', 'email', 'address', 'city'
		]
	
	def validate_email(self, value):
		"""Convert empty string to None for email field"""
		if value == '':
			return None
		return value
	
	def validate_date_of_birth(self, value):
		from datetime import date
		if value and value > date.today():
			raise serializers.ValidationError("تاریخ تولد نمی‌تواند در آینده باشد")
		return value
	
	def to_internal_value(self, data):
		"""Convert empty strings to None for optional fields"""
		# Convert empty strings to None for optional fields
		optional_fields = ['email', 'address', 'city']
		for field in optional_fields:
			if field in data and data[field] == '':
				data[field] = None
		return super().to_internal_value(data)


class TherapistOfferSerializer(serializers.ModelSerializer):
	therapist_id = serializers.IntegerField(source='therapist.id', read_only=True)
	therapist_name = serializers.SerializerMethodField()

	class Meta:
		model = TherapistOffer
		fields = [
			'id', 'session_request', 'therapist_id', 'therapist_name',
			'price', 'message', 'status', 'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at', 'therapist_id', 'therapist_name']

	def get_therapist_name(self, obj):
		profile = getattr(obj.therapist, 'therapist_profile', None)
		if profile and profile.first_name and profile.last_name:
			return f"{profile.first_name} {profile.last_name}"
		return obj.therapist.username


class TherapistOfferCreateSerializer(serializers.Serializer):
	price = serializers.IntegerField(min_value=0)
	message = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SessionRequestSerializer(serializers.ModelSerializer):
	patient_name = serializers.SerializerMethodField()
	patient_phone = serializers.SerializerMethodField()
	psychological_issue_title = serializers.SerializerMethodField()
	form_response_summary = serializers.SerializerMethodField()
	patients_count = serializers.SerializerMethodField()
	patients_list = serializers.SerializerMethodField()
	offers = serializers.SerializerMethodField()
	
	class Meta:
		model = SessionRequest
		fields = [
			'id', 'patient', 'patient_name', 'patient_phone',
			'psychological_issue', 'psychological_issue_title',
			'form_response', 'form_response_summary',
			'status', 'payment_status', 'price', 'price_currency',
			'approved_by', 'denied_by',
			'patient_choice', 'patient_accepted_at',
			'is_group_therapy', 'patients_count', 'patients_list',
			'offers',
			'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at', 'approved_by', 'denied_by']
	
	def get_patient_name(self, obj):
		if obj.patient:
			profile = getattr(obj.patient, 'profile', None)
			if profile and profile.first_name and profile.last_name:
				return f"{profile.first_name} {profile.last_name}"
			return obj.patient.username
		# For group therapy, return first patient's name
		if obj.is_group_therapy and obj.patients.exists():
			first_patient = obj.patients.first()
			profile = getattr(first_patient, 'profile', None)
			if profile and profile.first_name and profile.last_name:
				return f"{profile.first_name} {profile.last_name} (گروهی)"
			return f"{first_patient.username} (گروهی)"
		return "نامشخص"
	
	def get_patient_phone(self, obj):
		if obj.patient:
			return obj.patient.username
		if obj.is_group_therapy and obj.patients.exists():
			return obj.patients.first().username
		return ""
	
	def get_psychological_issue_title(self, obj):
		return obj.psychological_issue.title_fa or obj.psychological_issue.title
	
	def get_form_response_summary(self, obj):
		"""خلاصه پاسخ‌های فرم"""
		if obj.form_response:
			responses = obj.form_response.question_responses.all()[:3]
			summary = []
			for qr in responses:
				question_text = qr.question.text_fa or qr.question.text
				answer = qr.get_answer_display()
				summary.append(f"{question_text}: {answer}")
			return summary
		return []
	
	def get_patients_count(self, obj):
		"""تعداد بیماران در گروه"""
		if obj.is_group_therapy:
			return obj.patients.count()
		return 1
	
	def get_patients_list(self, obj):
		"""لیست بیماران با اطلاعات پروفایل"""
		patients_data = []
		patients = obj.patients.all() if obj.is_group_therapy else ([obj.patient] if obj.patient else [])
		
		for patient in patients:
			profile = getattr(patient, 'profile', None)
			patients_data.append({
				'id': patient.id,
				'phone': patient.username,
				'name': f"{profile.first_name} {profile.last_name}" if profile and profile.first_name and profile.last_name else patient.username,
				'first_name': profile.first_name if profile else None,
				'last_name': profile.last_name if profile else None,
			})
		return patients_data

	def get_offers(self, obj):
		offers = obj.offers.all().select_related('therapist__therapist_profile')
		return TherapistOfferSerializer(offers, many=True, context=self.context).data


class QuestionResponseDetailSerializer(serializers.Serializer):
	question_id = serializers.IntegerField()
	question_text = serializers.CharField()
	question_text_fa = serializers.CharField(allow_null=True)
	answer_text = serializers.CharField(allow_null=True)
	answer_number = serializers.FloatField(allow_null=True)
	answer_boolean = serializers.BooleanField(allow_null=True)


class CategorySerializer(serializers.ModelSerializer):
	display_name = serializers.SerializerMethodField()
	therapist_count = serializers.SerializerMethodField()
	sample_profile_image_url = serializers.SerializerMethodField()

	class Meta:
		model = Category
		fields = [
			'id', 'name', 'name_fa', 'display_name',
			'description', 'order',
			'therapist_count', 'sample_profile_image_url',
		]

	def get_display_name(self, obj):
		return obj.name_fa or obj.name

	def get_therapist_count(self, obj):
		return obj.therapist_profiles.filter(is_approved=True).count()

	def get_sample_profile_image_url(self, obj):
		therapist = (
			obj.therapist_profiles.filter(is_approved=True)
			.order_by('-approved_at', '-created_at')
			.first()
		)
		return get_bucket_file_url(therapist.profile_image) if therapist else None


class TherapistProfileSerializer(serializers.ModelSerializer):
	"""Serializer for therapist profile - only approved profiles are shown to patients"""
	user_id = serializers.IntegerField(source='user.id', read_only=True)
	user_phone = serializers.CharField(source='user.username', read_only=True)
	full_name = serializers.SerializerMethodField()
	profile_image_url = serializers.SerializerMethodField()
	activity_categories = CategorySerializer(many=True, read_only=True)
	activity_category_ids = serializers.PrimaryKeyRelatedField(
		source='activity_categories',
		many=True,
		read_only=True,
	)
	
	class Meta:
		model = TherapistProfile
		fields = [
			'id', 'user_id', 'user_phone',
			'first_name', 'last_name', 'full_name',
			'bio', 'profile_image', 'profile_image_url',
			'activity_categories', 'activity_category_ids',
			'specializations', 'years_of_experience',
			'education', 'certificates',
			'phone', 'email', 'address', 'city',
			'is_approved', 'approved_by', 'approved_at',
			'created_at', 'updated_at'
		]
		read_only_fields = [
			'id', 'user_id', 'user_phone', 'full_name',
			'is_approved', 'approved_by', 'approved_at',
			'created_at', 'updated_at'
		]
	
	def get_full_name(self, obj):
		return obj.get_full_name()
	
	def get_profile_image_url(self, obj):
		if obj.profile_image:
			return get_bucket_file_url(obj.profile_image)
		return None


class TherapistProfileUpdateSerializer(serializers.ModelSerializer):
	"""Serializer for therapists to update their profile"""
	activity_categories = serializers.PrimaryKeyRelatedField(
		queryset=Category.objects.filter(is_active=True).order_by('order', 'name'),
		many=True,
		required=False,
	)
	
	class Meta:
		model = TherapistProfile
		fields = [
			'first_name', 'last_name', 'bio', 'profile_image',
			'activity_categories',
			'specializations', 'years_of_experience',
			'education', 'certificates',
			'phone', 'email', 'address', 'city'
		]
	
	def validate_email(self, value):
		"""Convert empty string to None for email field"""
		if value == '':
			return None
		return value
	
	def to_internal_value(self, data):
		"""Convert empty strings to None for optional fields"""
		normalized_data = {}
		for key in data.keys():
			normalized_data[key] = data.get(key)

		optional_fields = ['email', 'address', 'city', 'phone', 'bio']
		for field in optional_fields:
			if field in normalized_data and normalized_data[field] == '':
				normalized_data[field] = None

		for field in ['specializations', 'certificates', 'activity_categories']:
			if field not in normalized_data:
				continue

			value = normalized_data[field]
			if isinstance(value, str):
				value = value.strip()
				if value == '':
					normalized_data[field] = []
					continue
				try:
					normalized_data[field] = json.loads(value)
					continue
				except json.JSONDecodeError:
					pass
				try:
					normalized_data[field] = ast.literal_eval(value)
					continue
				except (ValueError, SyntaxError):
					pass
			elif isinstance(value, tuple):
				normalized_data[field] = list(value)
				continue

		return super().to_internal_value(normalized_data)


class TherapistProfilePublicSerializer(serializers.ModelSerializer):
	"""Public serializer - only shows approved therapist profiles"""
	full_name = serializers.SerializerMethodField()
	profile_image_url = serializers.SerializerMethodField()
	activity_categories = CategorySerializer(many=True, read_only=True)
	
	class Meta:
		model = TherapistProfile
		fields = [
			'id', 'first_name', 'last_name', 'full_name',
			'bio', 'profile_image_url', 'activity_categories',
			'specializations', 'years_of_experience',
			'education', 'certificates',
			'city'
		]
		read_only_fields = ['id']
	
	def get_full_name(self, obj):
		return obj.get_full_name()
	
	def get_profile_image_url(self, obj):
		if obj.profile_image:
			return get_bucket_file_url(obj.profile_image)
		return None


class FormResponseRequestSerializer(serializers.ModelSerializer):
	form_id = serializers.IntegerField(source='form.id', read_only=True)
	form_title = serializers.CharField(source='form.title', read_only=True)
	form_title_fa = serializers.CharField(source='form.title_fa', read_only=True, allow_null=True)
	psychological_issue_id = serializers.IntegerField(source='psychological_issue.id', read_only=True)
	psychological_issue_title = serializers.CharField(source='psychological_issue.title', read_only=True)
	psychological_issue_title_fa = serializers.CharField(source='psychological_issue.title_fa', read_only=True, allow_null=True)
	user_id = serializers.IntegerField(source='user.id', read_only=True)
	user_phone = serializers.CharField(source='user.username', read_only=True)
	user_profile = serializers.SerializerMethodField()
	question_responses = serializers.SerializerMethodField()
	
	class Meta:
		model = FormResponse
		fields = [
			'id', 'form_id', 'form_title', 'form_title_fa',
			'psychological_issue_id', 'psychological_issue_title', 'psychological_issue_title_fa',
			'user_id', 'user_phone', 'user_profile',
			'created_at', 'updated_at', 'question_responses'
		]
	
	def get_user_profile(self, obj):
		profile = getattr(obj.user, 'profile', None)
		if profile:
			return {
				'first_name': profile.first_name,
				'last_name': profile.last_name,
				'date_of_birth': profile.date_of_birth.isoformat() if profile.date_of_birth else None,
				'gender': profile.gender,
				'email': profile.email,
				'city': profile.city,
			}
		return None
	
	def get_question_responses(self, obj):
		responses = obj.question_responses.all().select_related('question')
		result = []
		for qr in responses:
			result.append({
				'question_id': qr.question.id,
				'question_text': qr.question.text,
				'question_text_fa': qr.question.text_fa,
				'answer_text': qr.answer_text,
				'answer_number': qr.answer_number,
				'answer_boolean': qr.answer_boolean,
			})
		return result


class ChatMessageSerializer(serializers.ModelSerializer):
	sender_id = serializers.IntegerField(source='sender.id', read_only=True)
	sender_name = serializers.SerializerMethodField()
	is_mine = serializers.SerializerMethodField()
	voice_file_url = serializers.SerializerMethodField()
	
	class Meta:
		model = ChatMessage
		fields = [
			'id', 'session', 'sender_id', 'sender_name', 'message_type',
			'content', 'voice_file', 'voice_file_url', 'is_read', 'is_mine', 'created_at'
		]
		read_only_fields = ['id', 'created_at', 'is_read']
	
	def get_sender_name(self, obj):
		"""نام ارسال کننده"""
		if hasattr(obj.sender, 'profile'):
			profile = obj.sender.profile
			if profile.first_name and profile.last_name:
				return f"{profile.first_name} {profile.last_name}"
		elif hasattr(obj.sender, 'therapist_profile'):
			therapist_profile = obj.sender.therapist_profile
			if therapist_profile.first_name and therapist_profile.last_name:
				return f"{therapist_profile.first_name} {therapist_profile.last_name}"
		return obj.sender.username
	
	def get_is_mine(self, obj):
		"""آیا این پیام از طرف کاربر فعلی است؟"""
		request = self.context.get('request')
		if request and request.user:
			return obj.sender.id == request.user.id
		return False
	
	def get_voice_file_url(self, obj):
		"""URL فایل صوتی"""
		if obj.voice_file:
			return get_bucket_file_url(obj.voice_file)
		return None


class SupportChatSerializer(serializers.ModelSerializer):
	sender_id = serializers.IntegerField(source='sender.id', read_only=True)
	sender_name = serializers.SerializerMethodField()
	is_mine = serializers.SerializerMethodField()
	voice_file_url = serializers.SerializerMethodField()
	
	class Meta:
		model = SupportChat
		fields = [
			'id', 'user', 'sender_id', 'sender_name', 'is_support_staff',
			'message_type', 'content', 'voice_file', 'voice_file_url',
			'is_read', 'is_mine', 'created_at'
		]
		read_only_fields = ['id', 'created_at', 'is_read']
	
	def get_sender_name(self, obj):
		"""نام ارسال کننده"""
		if obj.is_support_staff:
			return 'پشتیبانی'
		if hasattr(obj.sender, 'profile'):
			profile = obj.sender.profile
			if profile.first_name and profile.last_name:
				return f"{profile.first_name} {profile.last_name}"
		elif hasattr(obj.sender, 'therapist_profile'):
			therapist_profile = obj.sender.therapist_profile
			if therapist_profile.first_name and therapist_profile.last_name:
				return f"{therapist_profile.first_name} {therapist_profile.last_name}"
		return obj.sender.username
	
	def get_is_mine(self, obj):
		"""آیا این پیام از طرف کاربر فعلی است؟"""
		request = self.context.get('request')
		if request and request.user:
			# Message is "mine" if:
			# 1. The sender is the current user
			# 2. AND it's not from support staff (support staff messages are never "mine" for patients)
			return obj.sender.id == request.user.id and not obj.is_support_staff
		return False
	
	def get_voice_file_url(self, obj):
		"""URL فایل صوتی"""
		if obj.voice_file:
			return get_bucket_file_url(obj.voice_file)
		return None


class TherapySessionSerializer(serializers.ModelSerializer):
	patient_name = serializers.SerializerMethodField()
	therapist_name = serializers.SerializerMethodField()
	therapist_profile_id = serializers.SerializerMethodField()
	therapist_profile_image_url = serializers.SerializerMethodField()
	patient_phone = serializers.SerializerMethodField()
	therapist_phone = serializers.CharField(source='therapist.username', read_only=True)
	latest_message = serializers.SerializerMethodField()
	unread_count = serializers.SerializerMethodField()
	patients_count = serializers.SerializerMethodField()
	patients_list = serializers.SerializerMethodField()
	current_user_id = serializers.SerializerMethodField()
	
	class Meta:
		model = TherapySession
		fields = [
			'id', 'session_request', 'patient', 'patient_name', 'patient_phone',
			'therapist', 'therapist_name', 'therapist_profile_id', 'therapist_profile_image_url', 'therapist_phone',
			'started_at', 'ended_at', 'is_active', 'is_group_therapy',
			'patients_count', 'patients_list', 'current_user_id',
			'latest_message', 'unread_count',
			'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at']
	
	def get_current_user_id(self, obj):
		"""Return the current user's ID from request context"""
		request = self.context.get('request')
		if request and request.user:
			return request.user.id
		return None
	
	def get_patient_name(self, obj):
		if obj.is_group_therapy:
			count = obj.patients.count()
			if count > 0:
				return f"گروه درمانی ({count} بیمار)"
			return "گروه درمانی"
		if obj.patient:
			if hasattr(obj.patient, 'profile'):
				profile = obj.patient.profile
				if profile.first_name and profile.last_name:
					return f"{profile.first_name} {profile.last_name}"
			return obj.patient.username
		return "نامشخص"
	
	def get_patient_phone(self, obj):
		if obj.patient:
			return obj.patient.username
		if obj.is_group_therapy and obj.patients.exists():
			return obj.patients.first().username
		return ""
	
	def get_therapist_name(self, obj):
		if hasattr(obj.therapist, 'therapist_profile'):
			profile = obj.therapist.therapist_profile
			if profile.first_name and profile.last_name:
				return f"{profile.first_name} {profile.last_name}"
		return obj.therapist.username

	def get_therapist_profile_id(self, obj):
		if hasattr(obj.therapist, 'therapist_profile'):
			return obj.therapist.therapist_profile.id
		return None

	def get_therapist_profile_image_url(self, obj):
		if hasattr(obj.therapist, 'therapist_profile') and obj.therapist.therapist_profile.profile_image:
			return get_bucket_file_url(obj.therapist.therapist_profile.profile_image)
		return None
	
	def get_patients_count(self, obj):
		"""تعداد بیماران در گروه"""
		if obj.is_group_therapy:
			return obj.patients.count()
		return 1
	
	def get_patients_list(self, obj):
		"""لیست بیماران با اطلاعات پروفایل"""
		patients_data = []
		patients = obj.patients.all() if obj.is_group_therapy else ([obj.patient] if obj.patient else [])
		
		for patient in patients:
			profile = getattr(patient, 'profile', None)
			patients_data.append({
				'id': patient.id,
				'phone': patient.username,
				'name': f"{profile.first_name} {profile.last_name}" if profile and profile.first_name and profile.last_name else patient.username,
				'first_name': profile.first_name if profile else None,
				'last_name': profile.last_name if profile else None,
			})
		return patients_data
	
	def get_latest_message(self, obj):
		latest = obj.chat_messages.last()
		if latest:
			return ChatMessageSerializer(latest, context=self.context).data
		return None
	
	def get_unread_count(self, obj):
		"""تعداد پیام‌های خوانده نشده برای کاربر فعلی"""
		request = self.context.get('request')
		if request and request.user:
			# پیام‌هایی که از طرف کاربر دیگر هستند و خوانده نشده‌اند
			from django.db.models import Q
			return obj.chat_messages.filter(
				~Q(sender_id=request.user.id),
				is_read=False
			).count()
		return 0


class PostReactionSerializer(serializers.ModelSerializer):
	user_id = serializers.IntegerField(source='user.id', read_only=True)
	user_name = serializers.SerializerMethodField()
	reaction_type_display = serializers.CharField(source='get_reaction_type_display', read_only=True)
	
	class Meta:
		model = PostReaction
		fields = ['id', 'user_id', 'user_name', 'reaction_type', 'reaction_type_display', 'created_at']
		read_only_fields = ['id', 'created_at']
	
	def get_user_name(self, obj):
		"""نام کاربر"""
		if hasattr(obj.user, 'profile'):
			profile = obj.user.profile
			if profile.first_name and profile.last_name:
				return f"{profile.first_name} {profile.last_name}"
		elif hasattr(obj.user, 'therapist_profile'):
			profile = obj.user.therapist_profile
			if profile.first_name and profile.last_name:
				return f"{profile.first_name} {profile.last_name}"
		return obj.user.username


class PostSerializer(serializers.ModelSerializer):
	"""Serializer for listing and retrieving posts"""
	therapist_id = serializers.IntegerField(source='therapist.id', read_only=True)
	therapist_name = serializers.SerializerMethodField()
	therapist_profile_image_url = serializers.SerializerMethodField()
	image_url = serializers.SerializerMethodField()
	video_url = serializers.SerializerMethodField()
	reactions_count = serializers.SerializerMethodField()
	reactions_by_type = serializers.SerializerMethodField()
	user_reaction = serializers.SerializerMethodField()
	post_type_display = serializers.CharField(source='get_post_type_display', read_only=True)
	
	class Meta:
		model = Post
		fields = [
			'id', 'therapist_id', 'therapist_name', 'therapist_profile_image_url',
			'post_type', 'post_type_display', 'content',
			'image', 'image_url', 'video', 'video_url',
			'is_active', 'reactions_count', 'reactions_by_type', 'user_reaction',
			'created_at', 'updated_at'
		]
		read_only_fields = ['id', 'created_at', 'updated_at']
	
	def get_therapist_name(self, obj):
		"""نام تراپیست"""
		return obj.get_therapist_name()
	
	def get_therapist_profile_image_url(self, obj):
		"""URL تصویر پروفایل تراپیست"""
		if hasattr(obj.therapist, 'therapist_profile') and obj.therapist.therapist_profile.profile_image:
			return get_bucket_file_url(obj.therapist.therapist_profile.profile_image)
		return None
	
	def get_image_url(self, obj):
		"""URL تصویر پست"""
		if obj.image:
			return get_bucket_file_url(obj.image)
		return None
	
	def get_video_url(self, obj):
		"""URL ویدیو پست"""
		if obj.video:
			return get_bucket_file_url(obj.video)
		return None
	
	def get_reactions_count(self, obj):
		"""تعداد کل واکنش‌ها"""
		return obj.get_reactions_count()
	
	def get_reactions_by_type(self, obj):
		"""تعداد واکنش‌ها بر اساس نوع"""
		reactions = obj.get_reactions_by_type()
		result = {}
		for item in reactions:
			result[item['reaction_type']] = item['count']
		return result
	
	def get_user_reaction(self, obj):
		"""واکنش کاربر فعلی به این پست"""
		request = self.context.get('request')
		if request and request.user.is_authenticated:
			try:
				reaction = PostReaction.objects.get(post=obj, user=request.user)
				return {
					'reaction_type': reaction.reaction_type,
					'reaction_type_display': reaction.get_reaction_type_display()
				}
			except PostReaction.DoesNotExist:
				return None
		return None


class PostCreateSerializer(serializers.ModelSerializer):
	"""Serializer for creating posts (therapists only)"""
	
	class Meta:
		model = Post
		fields = ['post_type', 'content', 'image', 'video']
	
	def validate(self, data):
		"""اعتبارسنجی بر اساس نوع پست"""
		post_type = data.get('post_type', 'TEXT')
		image = data.get('image')
		video = data.get('video')
		content = data.get('content', '').strip()
		
		if post_type == 'TEXT':
			if not content:
				raise serializers.ValidationError("محتوا برای پست متنی الزامی است")
			if image or video:
				raise serializers.ValidationError("پست متنی نباید تصویر یا ویدیو داشته باشد")
		elif post_type == 'IMAGE':
			if not image:
				raise serializers.ValidationError("تصویر برای پست تصویری الزامی است")
			if video:
				raise serializers.ValidationError("پست تصویری نباید ویدیو داشته باشد")
		elif post_type == 'VIDEO':
			if not video:
				raise serializers.ValidationError("ویدیو برای پست ویدیویی الزامی است")
			if image:
				raise serializers.ValidationError("پست ویدیویی نباید تصویر داشته باشد")
		
		return data


class PostReactionCreateSerializer(serializers.Serializer):
	"""Serializer for creating/updating reactions"""
	reaction_type = serializers.ChoiceField(choices=PostReaction.REACTION_TYPE_CHOICES)
	
	def validate_reaction_type(self, value):
		"""اعتبارسنجی نوع واکنش"""
		return value


class DeviceTokenSerializer(serializers.ModelSerializer):
	"""Serializer for device tokens"""
	class Meta:
		model = DeviceToken
		fields = ['id', 'token', 'device_type', 'device_name', 'is_active', 'created_at']
		read_only_fields = ['id', 'created_at']


class DeviceTokenRegisterSerializer(serializers.Serializer):
	"""Serializer for registering device token"""
	token = serializers.CharField(max_length=255, required=True)
	device_type = serializers.ChoiceField(choices=DeviceToken.DEVICE_TYPE_CHOICES, required=True)
	device_name = serializers.CharField(max_length=100, required=False, allow_blank=True)
	
	def validate_token(self, value):
		"""اعتبارسنجی توکن"""
		if not value or len(value) < 10:
			raise serializers.ValidationError("توکن نامعتبر است")
		return value


class NotificationSerializer(serializers.ModelSerializer):
	"""Serializer for notifications"""
	sent_by_username = serializers.SerializerMethodField()
	
	class Meta:
		model = Notification
		fields = ['id', 'title', 'message', 'sent_by', 'sent_by_username', 'sent_at', 'is_read', 'read_at']
		read_only_fields = ['id', 'sent_at', 'read_at']
	
	def get_sent_by_username(self, obj):
		return obj.sent_by.username if obj.sent_by else None


class WalletTransactionSerializer(serializers.ModelSerializer):
	session_request_id = serializers.IntegerField(source='session_request.id', read_only=True)
	
	class Meta:
		model = WalletTransaction
		fields = [
			'id', 'transaction_type', 'amount', 'currency', 'description',
			'balance_after', 'metadata', 'session_request_id', 'created_at'
		]
		read_only_fields = [
			'id', 'transaction_type', 'amount', 'currency',
			'description', 'balance_after', 'metadata',
			'session_request_id', 'created_at'
		]


class WalletSerializer(serializers.ModelSerializer):
	available_balance = serializers.SerializerMethodField()
	recent_transactions = serializers.SerializerMethodField()
	
	class Meta:
		model = Wallet
		fields = [
			'balance', 'reserved_balance', 'currency',
			'available_balance', 'recent_transactions'
		]
		read_only_fields = [
			'balance', 'reserved_balance', 'currency',
			'available_balance', 'recent_transactions'
		]
	
	def get_available_balance(self, obj):
		return obj.available_balance
	
	def get_recent_transactions(self, obj):
		transactions = obj.transactions.all().order_by('-created_at')[:20]
		return WalletTransactionSerializer(transactions, many=True).data


class SendNotificationSerializer(serializers.Serializer):
	"""Serializer for sending notifications from admin"""
	user_ids = serializers.ListField(
		child=serializers.IntegerField(),
		required=True,
		help_text="لیست ID کاربران"
	)
	title = serializers.CharField(max_length=200, required=True)
	message = serializers.CharField(required=True)
	user_type = serializers.ChoiceField(
		choices=[('all', 'همه'), ('patient', 'بیماران'), ('therapist', 'درمانگران')],
		required=False,
		default='all'
	)
