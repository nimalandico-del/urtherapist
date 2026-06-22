from django.contrib import admin
from django.forms import ModelForm
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import Category, PsychologicalIssue, Form, Question, FormResponse, QuestionResponse, UserProfile, SessionRequest, TherapistProfile, Post, PostReaction, DeviceToken, Notification, SupportChat, Wallet, WalletTransaction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
	list_display = ['name', 'name_fa', 'is_active', 'order', 'created_at']
	list_filter = ['is_active', 'created_at']
	search_fields = ['name', 'name_fa', 'description']
	list_editable = ['is_active', 'order']
	ordering = ['order', 'name']
	
	fieldsets = (
		('اطلاعات اصلی', {
			'fields': ('name', 'name_fa', 'is_active', 'order')
		}),
		('توضیحات', {
			'fields': ('description',),
			'classes': ('wide',)
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)
	
	readonly_fields = ['created_at', 'updated_at']


@admin.register(PsychologicalIssue)
class PsychologicalIssueAdmin(admin.ModelAdmin):
	list_display = ['title', 'title_fa', 'category', 'order', 'is_active', 'has_form', 'created_at']
	list_filter = ['is_active', 'category', 'created_at']
	search_fields = ['title', 'title_fa', 'description', 'category__name', 'category__name_fa']
	list_editable = ['order', 'is_active']
	ordering = ['category__order', 'order', 'title']
	
	fieldsets = (
		('اطلاعات اصلی', {
			'fields': ('title', 'title_fa', 'category', 'order', 'is_active')
		}),
		('تصویر', {
			'fields': ('image',),
		}),
		('توضیحات', {
			'fields': ('description',),
			'classes': ('wide',)
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)
	
	readonly_fields = ['created_at', 'updated_at']

	def has_form(self, obj):
		return hasattr(obj, 'form') and obj.form is not None
	has_form.boolean = True
	has_form.short_description = 'فرم دارد'


class QuestionInline(admin.StackedInline):
	model = Question
	extra = 1
	fields = ('order', 'text_fa', 'text', 'question_type', 'options_fa', 'options', 'is_required', 'is_active')
	ordering = ('order', 'id')
	
	def get_fields(self, request, obj=None):
		# همیشه همه فیلدها را نمایش بده
		return ('order', 'text_fa', 'text', 'question_type', 'options_fa', 'options', 'is_required', 'is_active')
	
	def get_fieldsets(self, request, obj=None):
		return (
			(None, {
				'fields': ('order', 'text_fa', 'text', 'question_type', 'options_fa', 'options', 'is_required', 'is_active'),
				'description': 'برای سوالات نوع "چهار گزینه‌ای"، فیلدهای options_fa یا options را با کاما (,) پر کنید. مثال: گزینه 1, گزینه 2, گزینه 3, گزینه 4'
			}),
		)


@admin.register(Form)
class FormAdmin(admin.ModelAdmin):
	list_display = ['title_fa', 'title', 'psychological_issue', 'session_price', 'is_active', 'question_count', 'created_at']
	list_filter = ['is_active', 'created_at']
	search_fields = ['title', 'title_fa', 'description', 'psychological_issue__title', 'psychological_issue__title_fa']
	list_editable = ['is_active']
	ordering = ['title']
	inlines = [QuestionInline]
	
	fieldsets = (
		('اطلاعات اصلی', {
			'fields': ('psychological_issue', 'title', 'title_fa', 'session_price', 'is_active')
		}),
		('درمان گروهی', {
			'fields': ('group_therapy_enabled', 'group_therapy_max_patients'),
			'description': 'فعال‌سازی درمان گروهی برای این فرم. در صورت فعال بودن، بیماران می‌توانند درخواست درمان گروهی دهند.'
		}),
		('توضیحات', {
			'fields': ('description',),
			'classes': ('wide',)
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)
	
	readonly_fields = ['created_at', 'updated_at']

	def question_count(self, obj):
		return obj.questions.count()
	question_count.short_description = 'تعداد سوالات'


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
	list_display = ['text_fa', 'text', 'form', 'question_type', 'is_required', 'is_active', 'order']
	list_filter = ['question_type', 'is_required', 'is_active', 'form']
	search_fields = ['text', 'text_fa', 'form__title', 'form__title_fa']
	list_editable = ['order', 'is_required', 'is_active']
	ordering = ['form', 'order', 'id']
	
	fieldsets = (
		('اطلاعات اصلی', {
			'fields': ('form', 'text_fa', 'text', 'question_type', 'is_required', 'is_active', 'order')
		}),
		('گزینه‌ها', {
			'fields': ('options_fa', 'options'),
			'description': '⚠️ برای سوالات نوع "چهار گزینه‌ای" (multiple_choice_4) الزامی است. گزینه‌ها را با کاما (,) جدا کنید.\nمثال: گزینه اول, گزینه دوم, گزینه سوم, گزینه چهارم\nبرای سایر انواع سوالات، این فیلدها را خالی بگذارید.',
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)
	
	readonly_fields = ['created_at', 'updated_at']


class QuestionResponseInline(admin.TabularInline):
	model = QuestionResponse
	extra = 0
	readonly_fields = ['question', 'get_answer_display']
	can_delete = False
	
	def get_answer_display(self, obj):
		return obj.get_answer_display()
	get_answer_display.short_description = 'پاسخ'
	
	def has_add_permission(self, request, obj=None):
		return False


@admin.register(FormResponse)
class FormResponseAdmin(admin.ModelAdmin):
	list_display = ['user', 'form', 'psychological_issue', 'created_at']
	list_filter = ['created_at', 'form', 'psychological_issue']
	search_fields = ['user__username', 'form__title', 'form__title_fa', 'psychological_issue__title']
	readonly_fields = ['form', 'user', 'psychological_issue', 'created_at', 'updated_at']
	ordering = ['-created_at']
	inlines = [QuestionResponseInline]
	
	def has_add_permission(self, request):
		return False
	
	def has_change_permission(self, request, obj=None):
		return False


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
	list_display = ['user', 'first_name', 'last_name', 'phone', 'is_complete_status', 'created_at']
	list_filter = ['gender', 'city', 'created_at']
	search_fields = ['user__username', 'first_name', 'last_name', 'phone', 'email']
	ordering = ['user__username']
	
	fieldsets = (
		('اطلاعات کاربر', {
			'fields': ('user',)
		}),
		('اطلاعات شخصی (اجباری)', {
			'fields': ('first_name', 'last_name', 'date_of_birth', 'gender'),
			'description': 'این فیلدها برای تکمیل پروفایل الزامی هستند'
		}),
		('اطلاعات تماس', {
			'fields': ('phone', 'email'),
		}),
		('آدرس', {
			'fields': ('city', 'address'),
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)
	
	readonly_fields = ['user', 'created_at', 'updated_at']

	def is_complete_status(self, obj):
		return obj.is_complete()
	is_complete_status.boolean = True
	is_complete_status.short_description = 'پروفایل کامل'


@admin.register(SessionRequest)
class SessionRequestAdmin(admin.ModelAdmin):
	list_display = ['id', 'get_patients_display', 'psychological_issue', 'is_group_therapy', 'status', 'approved_by', 'denied_by', 'created_at']
	list_filter = ['status', 'is_group_therapy', 'created_at', 'psychological_issue']
	search_fields = ['patient__username', 'patients__username', 'psychological_issue__title', 'psychological_issue__title_fa']
	readonly_fields = ['created_at', 'updated_at']
	ordering = ['-created_at']
	filter_horizontal = ['patients']
	
	fieldsets = (
		('اطلاعات درخواست', {
			'fields': ('form_response', 'patient', 'psychological_issue', 'is_group_therapy', 'status')
		}),
		('بیماران', {
			'fields': ('patients',),
			'description': 'لیست بیماران در این درخواست (برای درمان گروهی)'
		}),
		('وضعیت', {
			'fields': ('approved_by', 'denied_by')
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)
	
	def get_patients_display(self, obj):
		if obj.is_group_therapy:
			count = obj.patients.count()
			return f"گروه ({count} بیمار)"
		if obj.patient:
			return str(obj.patient)
		return "نامشخص"
	get_patients_display.short_description = 'بیمار(ان)'


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
	list_display = ['user', 'balance', 'reserved_balance', 'currency', 'updated_at']
	search_fields = ['user__username']
	readonly_fields = ['user', 'balance', 'reserved_balance', 'created_at', 'updated_at']
	ordering = ['-updated_at']


@admin.register(WalletTransaction)
class WalletTransactionAdmin(admin.ModelAdmin):
	list_display = ['user', 'transaction_type', 'amount', 'balance_after', 'session_request', 'created_at']
	list_filter = ['transaction_type', 'currency', 'created_at']
	search_fields = ['user__username', 'description']
	readonly_fields = ['wallet', 'user', 'session_request', 'transaction_type', 'amount', 'currency', 'description', 'balance_after', 'metadata', 'created_at']
	ordering = ['-created_at']


@admin.register(TherapistProfile)
class TherapistProfileAdmin(admin.ModelAdmin):
	list_display = ['id', 'user', 'get_full_name', 'is_approved', 'years_of_experience', 'approved_by', 'approved_at', 'created_at']
	list_filter = ['is_approved', 'created_at', 'city']
	search_fields = ['first_name', 'last_name', 'user__username', 'email', 'phone']
	readonly_fields = ['user', 'created_at', 'updated_at', 'approved_at']
	ordering = ['-created_at']
	filter_horizontal = ['activity_categories']
	
	fieldsets = (
		('اطلاعات کاربر', {
			'fields': ('user',)
		}),
		('اطلاعات شخصی', {
			'fields': ('first_name', 'last_name', 'bio', 'profile_image')
		}),
		('اطلاعات حرفه‌ای', {
			'fields': ('activity_categories', 'specializations', 'years_of_experience', 'education', 'certificates')
		}),
		('اطلاعات تماس', {
			'fields': ('phone', 'email', 'address', 'city')
		}),
		('وضعیت تأیید', {
			'fields': ('is_approved', 'approved_by', 'approved_at', 'rejection_reason')
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)
	
	actions = ['approve_profiles', 'reject_profiles']
	
	def approve_profiles(self, request, queryset):
		"""تأیید پروفایل‌های انتخاب شده"""
		from django.utils import timezone
		updated = queryset.update(
			is_approved=True,
			approved_by=request.user,
			approved_at=timezone.now(),
			rejection_reason=None
		)
		self.message_user(request, f'{updated} پروفایل تأیید شد.')
	approve_profiles.short_description = 'تأیید پروفایل‌های انتخاب شده'
	
	def reject_profiles(self, request, queryset):
		"""رد پروفایل‌های انتخاب شده"""
		updated = queryset.update(
			is_approved=False,
			approved_by=None,
			approved_at=None
		)
		self.message_user(request, f'{updated} پروفایل رد شد.')
	reject_profiles.short_description = 'رد پروفایل‌های انتخاب شده'
	
	def save_model(self, request, obj, form, change):
		"""ذخیره پروفایل و ثبت اطلاعات تأیید"""
		from django.utils import timezone
		
		# اگر وضعیت تأیید تغییر کرده
		if change:
			old_obj = TherapistProfile.objects.get(pk=obj.pk)
			
			# اگر به تأیید شده تغییر کرده
			if not old_obj.is_approved and obj.is_approved:
				if not obj.approved_by:
					obj.approved_by = request.user
				if not obj.approved_at:
					obj.approved_at = timezone.now()
				obj.rejection_reason = None
			# اگر رد شده
			elif old_obj.is_approved and not obj.is_approved:
				obj.approved_by = None
				obj.approved_at = None
		
		super().save_model(request, obj, form, change)


class PostReactionInline(admin.TabularInline):
	model = PostReaction
	extra = 0
	readonly_fields = ['user', 'reaction_type', 'created_at']
	can_delete = False
	
	def has_add_permission(self, request, obj=None):
		return False


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
	list_display = ['id', 'get_therapist_name', 'post_type', 'content_preview', 'is_active', 'reactions_count', 'created_at']
	list_filter = ['post_type', 'is_active', 'created_at']
	search_fields = ['content', 'therapist__username', 'therapist__therapist_profile__first_name', 'therapist__therapist_profile__last_name']
	list_editable = ['is_active']
	readonly_fields = ['therapist', 'created_at', 'updated_at']
	ordering = ['-created_at']
	inlines = [PostReactionInline]
	
	fieldsets = (
		('اطلاعات اصلی', {
			'fields': ('therapist', 'post_type', 'content', 'is_active')
		}),
		('رسانه', {
			'fields': ('image', 'video'),
			'description': 'برای پست‌های تصویری، فیلد image را پر کنید. برای پست‌های ویدیویی، فیلد video را پر کنید.'
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)
	
	def get_therapist_name(self, obj):
		return obj.get_therapist_name()
	get_therapist_name.short_description = 'تراپیست'
	
	def content_preview(self, obj):
		"""پیش‌نمایش محتوا"""
		if len(obj.content) > 50:
			return obj.content[:50] + '...'
		return obj.content
	content_preview.short_description = 'محتوا'
	
	def reactions_count(self, obj):
		"""تعداد واکنش‌ها"""
		return obj.get_reactions_count()
	reactions_count.short_description = 'تعداد واکنش‌ها'
	
	def has_add_permission(self, request):
		"""فقط admin می‌تواند پست اضافه کند (یا از طریق API)"""
		return request.user.is_superuser
	
	def has_delete_permission(self, request, obj=None):
		"""Admin می‌تواند پست‌ها را حذف کند"""
		return request.user.is_superuser or request.user.is_staff
	
	def has_change_permission(self, request, obj=None):
		"""Admin می‌تواند پست‌ها را ویرایش کند"""
		return request.user.is_superuser or request.user.is_staff


@admin.register(PostReaction)
class PostReactionAdmin(admin.ModelAdmin):
	list_display = ['id', 'post', 'user', 'reaction_type', 'created_at']
	list_filter = ['reaction_type', 'created_at']
	search_fields = ['post__content', 'user__username']
	readonly_fields = ['post', 'user', 'reaction_type', 'created_at']
	ordering = ['-created_at']
	
	fieldsets = (
		('اطلاعات واکنش', {
			'fields': ('post', 'user', 'reaction_type')
		}),
		('زمان', {
			'fields': ('created_at',),
			'classes': ('collapse',)
		}),
	)
	
	def has_add_permission(self, request):
		"""واکنش‌ها فقط از طریق API ایجاد می‌شوند"""
		return False
	
	def has_delete_permission(self, request, obj=None):
		"""Admin می‌تواند واکنش‌ها را حذف کند"""
		return request.user.is_superuser or request.user.is_staff
	
	def has_change_permission(self, request, obj=None):
		"""واکنش‌ها قابل ویرایش نیستند"""
		return False


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
	list_display = ['user', 'device_type', 'device_name', 'is_active', 'created_at']
	list_filter = ['device_type', 'is_active', 'created_at']
	search_fields = ['user__username', 'token', 'device_name']
	readonly_fields = ['created_at', 'updated_at']
	ordering = ['-created_at']
	
	fieldsets = (
		('اطلاعات دستگاه', {
			'fields': ('user', 'token', 'device_type', 'device_name', 'is_active')
		}),
		('زمان‌ها', {
			'fields': ('created_at', 'updated_at'),
			'classes': ('collapse',)
		}),
	)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
	list_display = ['title', 'user', 'sent_by', 'is_read', 'sent_at']
	list_filter = ['is_read', 'sent_at', 'sent_by']
	search_fields = ['title', 'message', 'user__username', 'sent_by__username']
	readonly_fields = ['sent_at', 'read_at']
	ordering = ['-sent_at']
	
	fieldsets = (
		('اطلاعات نوتیفیکیشن', {
			'fields': ('user', 'title', 'message', 'sent_by')
		}),
		('وضعیت', {
			'fields': ('is_read', 'read_at')
		}),
		('زمان‌ها', {
			'fields': ('sent_at',),
			'classes': ('collapse',)
		}),
	)
	
	def has_add_permission(self, request):
		"""نوتیفیکیشن‌ها از طریق action ارسال می‌شوند"""
		return False


# Custom admin action to send notifications
@admin.action(description='ارسال نوتیفیکیشن به کاربران انتخاب شده')
def send_notification_action(modeladmin, request, queryset):
	"""Action برای ارسال نوتیفیکیشن از admin"""
	from django.contrib import messages
	from .services import PushNotificationService
	
	# Get notification data from request
	title = request.POST.get('notification_title', '')
	message = request.POST.get('notification_message', '')
	
	if not title or not message:
		messages.error(request, 'لطفاً عنوان و پیام نوتیفیکیشن را وارد کنید.')
		return
	
	service = PushNotificationService()
	success_count = 0
	fail_count = 0
	
	for user in queryset:
		try:
			# Send push notification
			result = service.send_notification_to_user(
				user=user,
				title=title,
				message=message,
				sent_by=request.user
			)
			if result['success']:
				success_count += 1
			else:
				fail_count += 1
		except Exception as e:
			fail_count += 1
			messages.error(request, f'خطا در ارسال به {user.username}: {str(e)}')
	
	messages.success(request, f'{success_count} نوتیفیکیشن با موفقیت ارسال شد.')
	if fail_count > 0:
		messages.warning(request, f'{fail_count} نوتیفیکیشن ارسال نشد.')


# Add custom admin view for sending notifications
from django.contrib.auth import get_user_model
from django.shortcuts import render, redirect
from django.contrib import messages

User = get_user_model()

def send_notification_view(request):
	"""صفحه ارسال نوتیفیکیشن در admin"""
	if not request.user.is_superuser:
		messages.error(request, 'شما دسترسی به این صفحه ندارید.')
		return redirect('admin:index')
	
	if request.method == 'POST':
		title = request.POST.get('title', '').strip()
		message = request.POST.get('message', '').strip()
		user_ids = request.POST.getlist('users')
		user_type = request.POST.get('user_type', 'all')  # all, patient, therapist
		
		if not title or not message:
			messages.error(request, 'لطفاً عنوان و پیام را وارد کنید.')
		elif not user_ids:
			messages.error(request, 'لطفاً حداقل یک کاربر را انتخاب کنید.')
		else:
			from .services import PushNotificationService
			service = PushNotificationService()
			
			users = User.objects.filter(id__in=user_ids)
			if user_type == 'patient':
				# Filter to only patients (users without therapist profile or with rejected profile)
				users = users.exclude(therapist_profile__is_approved=True)
			elif user_type == 'therapist':
				# Filter to only therapists (users with approved therapist profile)
				users = users.filter(therapist_profile__is_approved=True)
			
			success_count = 0
			fail_count = 0
			
			for user in users:
				try:
					# Check if user has device tokens
					from .models import DeviceToken
					has_tokens = DeviceToken.objects.filter(user=user, is_active=True).exists()
					
					result = service.send_notification_to_user(
						user=user,
						title=title,
						message=message,
						sent_by=request.user
					)
					
					if result.get('success'):
						success_count += 1
					else:
						fail_count += 1
						error_msg = result.get('error', 'Unknown error')
						if 'دستگاه فعالی ندارد' in error_msg or 'no device' in error_msg.lower():
							# Notification saved but no push sent - this is expected if no tokens
							pass
						else:
							messages.warning(request, f'{user.username}: {error_msg}')
				except Exception as e:
					fail_count += 1
					messages.error(request, f'خطا در ارسال به {user.username}: {str(e)}')
			
			# Count users with device tokens
			users_with_tokens = sum(1 for user in users if DeviceToken.objects.filter(user=user, is_active=True).exists())
			users_without_tokens = len(users) - users_with_tokens
			
			if success_count > 0:
				messages.success(request, f'{success_count} نوتیفیکیشن پوش با موفقیت ارسال شد.')
			
			if users_without_tokens > 0:
				messages.info(request, f'{users_without_tokens} کاربر دستگاه ثبت شده ندارند. نوتیفیکیشن‌ها در دیتابیس ذخیره شدند و در اپلیکیشن نمایش داده می‌شوند.')
			
			if fail_count > 0 and success_count == 0:
				messages.warning(request, f'{fail_count} نوتیفیکیشن ارسال نشد. احتمالاً کاربران دستگاه ثبت شده ندارند.')
			
			return redirect('admin_send_notification')
	
	# Get all users with device token count
	all_users = User.objects.all().select_related('profile', 'therapist_profile').prefetch_related('device_tokens')
	
	context = {
		'title': 'ارسال نوتیفیکیشن',
		'users': all_users,
		'opts': User._meta,
		'has_view_permission': True,
		'has_add_permission': False,
		'has_change_permission': False,
		'has_delete_permission': False,
	}
	
	return render(request, 'admin/send_notification.html', context)


def support_chat_view(request):
	"""صفحه چت پشتیبانی در admin - رابط چت مانند"""
	if not (request.user.is_staff or request.user.is_superuser):
		messages.error(request, 'شما دسترسی به این صفحه ندارید.')
		return redirect('admin:index')
	
	from django.db.models import Count, Max, Q
	from .models import UserProfile
	from channels.layers import get_channel_layer
	from asgiref.sync import async_to_sync
	from .serializers import SupportChatSerializer
	
	# Handle POST request (sending message)
	if request.method == 'POST':
		selected_user_id = request.POST.get('user_id')
		message_content = request.POST.get('content', '').strip()
		
		if not message_content:
			messages.error(request, 'لطفاً متن پیام را وارد کنید.')
		elif not selected_user_id:
			messages.error(request, 'کاربر انتخاب نشده است.')
		else:
			try:
				target_user = User.objects.get(id=selected_user_id)
				# Create support message
				support_message = SupportChat.objects.create(
					user=target_user,
					sender=request.user,
					is_support_staff=True,
					message_type='TEXT',
					content=message_content,
					is_read=False
				)
				
				# Send via WebSocket
				channel_layer = get_channel_layer()
				if channel_layer:
					serializer = SupportChatSerializer(support_message, context={'request': request})
					async_to_sync(channel_layer.group_send)(
						f'support_chat_{selected_user_id}',
						{
							'type': 'support_message',
							'data': serializer.data
						}
					)
				
				messages.success(request, 'پیام با موفقیت ارسال شد.')
				return redirect(f'{request.path}?user_id={selected_user_id}')
			except User.DoesNotExist:
				messages.error(request, 'کاربر یافت نشد.')
			except Exception as e:
				messages.error(request, f'خطا در ارسال پیام: {str(e)}')
	
	# Get selected user ID
	selected_user_id = request.GET.get('user_id', None)
	selected_user = None
	chat_messages = []
	
	if selected_user_id:
		try:
			selected_user = User.objects.get(id=selected_user_id)
			# Get all messages for this user
			chat_messages = SupportChat.objects.filter(
				user_id=selected_user_id
			).select_related('sender', 'user').order_by('created_at')
			
			# Mark user messages as read when support staff views them
			SupportChat.objects.filter(
				Q(user_id=selected_user_id) & 
				~Q(sender_id=request.user.id) & 
				Q(is_read=False)
			).update(is_read=True)
		except User.DoesNotExist:
			messages.error(request, 'کاربر یافت نشد.')
	
	# Get all distinct users who have support chats
	# Use dictionary to ensure each user appears only once (keyed by user_id)
	users_dict = {}
	
	# Get all support chats and group by user
	all_chats = SupportChat.objects.select_related('user').order_by('-created_at')
	
	for chat in all_chats:
		user_id = chat.user_id
		
		# Skip if we've already processed this user
		if user_id in users_dict:
			continue
		
		# Get user object
		user_obj = chat.user
		
		# Get message statistics for this user
		user_messages = SupportChat.objects.filter(user_id=user_id)
		total_messages = user_messages.count()
		unread_count = user_messages.filter(is_read=False, is_support_staff=False).count()
		last_message = user_messages.order_by('-created_at').first()
		last_message_at = last_message.created_at if last_message else None
		
		# Get user profile and name
		try:
			profile = UserProfile.objects.get(user_id=user_id)
			user_name = f"{profile.first_name} {profile.last_name}".strip() if profile.first_name or profile.last_name else user_obj.username
		except UserProfile.DoesNotExist:
			user_name = user_obj.username
		
		# Store in dictionary (this ensures uniqueness)
		users_dict[user_id] = {
			'user_id': user_id,
			'username': user_obj.username,
			'name': user_name,
			'total_messages': total_messages,
			'unread_count': unread_count,
			'last_message_at': last_message_at,
		}
	
	# Convert dictionary values to list
	user_list = list(users_dict.values())
	
	# Sort by last message time (most recent first)
	from datetime import datetime
	user_list.sort(key=lambda x: x['last_message_at'] if x['last_message_at'] else datetime.min.replace(tzinfo=timezone.utc), reverse=True)
	
	context = {
		'title': 'چت پشتیبانی',
		'users': user_list,
		'selected_user': selected_user,
		'chat_messages': chat_messages,
		'opts': SupportChat._meta,
		'has_view_permission': True,
		'has_add_permission': False,
		'has_change_permission': False,
		'has_delete_permission': False,
	}
	
	return render(request, 'admin/support_chat.html', context)


@admin.register(SupportChat)
class SupportChatAdmin(admin.ModelAdmin):
	list_display = ['id', 'user', 'sender', 'is_support_staff', 'message_type', 'content_preview', 'is_read', 'created_at', 'chat_link']
	list_filter = ['is_support_staff', 'is_read', 'message_type', 'created_at']
	search_fields = ['user__username', 'sender__username', 'content']
	readonly_fields = ['created_at']
	ordering = ['-created_at']
	
	def content_preview(self, obj):
		if obj.message_type == 'VOICE':
			return '🎤 پیام صوتی'
		content = obj.content[:50]
		return content + '...' if len(obj.content) > 50 else content
	content_preview.short_description = 'محتوا'
	
	def chat_link(self, obj):
		url = reverse('admin_support_chat') + f'?user_id={obj.user.id}'
		return format_html('<a href="{}" style="background: #417690; color: white; padding: 5px 10px; border-radius: 4px; text-decoration: none;">💬 چت</a>', url)
	chat_link.short_description = 'چت'
	chat_link.allow_tags = True
	
	fieldsets = (
		('اطلاعات پیام', {
			'fields': ('user', 'sender', 'is_support_staff', 'message_type', 'content', 'voice_file', 'is_read')
		}),
		('زمان', {
			'fields': ('created_at',),
			'classes': ('collapse',)
		}),
	)
	
	def changelist_view(self, request, extra_context=None):
		extra_context = extra_context or {}
		extra_context['chat_url'] = reverse('admin_support_chat')
		return super().changelist_view(request, extra_context=extra_context)

