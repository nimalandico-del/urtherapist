from django.db import models
from django.conf import settings

# Import storage backend - safe since it only imports settings, not models
try:
	from core.storage_backends import LiaraMediaStorage
except ImportError:
	# Fallback if storage_backends is not available
	LiaraMediaStorage = None


class PhoneOTP(models.Model):
	phone = models.CharField(max_length=20, db_index=True)
	code = models.CharField(max_length=6)
	created_at = models.DateTimeField(auto_now_add=True)
	expires_at = models.DateTimeField()
	resend_after = models.DateTimeField()
	attempts = models.PositiveIntegerField(default=0)
	verified = models.BooleanField(default=False)

	class Meta:
		indexes = [
			models.Index(fields=["phone", "created_at"]),
		]

	def __str__(self):
		return f"OTP({self.phone}, {self.code}, verified={self.verified})"


class Category(models.Model):
	"""دسته‌بندی مسائل روانشناختی"""
	name = models.CharField(max_length=100, verbose_name='نام دسته‌بندی')
	name_fa = models.CharField(max_length=100, blank=True, null=True, verbose_name='نام فارسی')
	description = models.TextField(blank=True, null=True, verbose_name='توضیحات')
	is_active = models.BooleanField(default=True, verbose_name='فعال')
	order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
	created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
	updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ بروزرسانی')

	class Meta:
		verbose_name = 'دسته‌بندی'
		verbose_name_plural = 'دسته‌بندی‌ها'
		ordering = ['order', 'name']
		indexes = [
			models.Index(fields=['is_active', 'order']),
		]

	def __str__(self):
		return self.name_fa or self.name


class PsychologicalIssue(models.Model):
	title = models.CharField(max_length=200)
	title_fa = models.CharField(max_length=200, blank=True, null=True)
	description = models.TextField(blank=True, null=True)
	category = models.ForeignKey(
		Category,
		on_delete=models.SET_NULL,
		blank=True,
		null=True,
		related_name='psychological_issues',
		verbose_name='دسته‌بندی'
	)
	image = models.ImageField(upload_to='psychological_issues/', blank=True, null=True)
	is_active = models.BooleanField(default=True)
	order = models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		ordering = ['order', 'title']
		indexes = [
			models.Index(fields=['is_active', 'order']),
			models.Index(fields=['category', 'order']),
		]

	def __str__(self):
		return self.title_fa or self.title


class Form(models.Model):
	psychological_issue = models.OneToOneField(
		PsychologicalIssue,
		on_delete=models.CASCADE,
		related_name='form',
		verbose_name='مسئله روانشناختی'
	)
	title = models.CharField(max_length=200, verbose_name='عنوان فرم')
	title_fa = models.CharField(max_length=200, blank=True, null=True, verbose_name='عنوان فارسی')
	description = models.TextField(blank=True, null=True, verbose_name='توضیحات')
	session_price = models.BigIntegerField(default=0, verbose_name='هزینه هر جلسه (ریال)')
	is_active = models.BooleanField(default=True, verbose_name='فعال')
	group_therapy_enabled = models.BooleanField(default=False, verbose_name='درمان گروهی فعال')
	group_therapy_max_patients = models.PositiveIntegerField(
		default=3,
		verbose_name='حداکثر تعداد بیماران در درمان گروهی',
		help_text='حداکثر تعداد بیمارانی که می‌توانند در یک گروه درمانی شرکت کنند'
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'فرم'
		verbose_name_plural = 'فرم‌ها'
		ordering = ['title']

	def __str__(self):
		return self.title_fa or self.title or f"Form for {self.psychological_issue}"


class Question(models.Model):
	QUESTION_TYPE_CHOICES = [
		('yes_no', 'بله/خیر'),
		('descriptive', 'توضیحات (متن طولانی)'),
		('multiple_choice_4', 'چهار گزینه‌ای'),
		('short_text', 'متن کوتاه'),
		('number', 'عدد'),
	]

	form = models.ForeignKey(
		Form,
		on_delete=models.CASCADE,
		related_name='questions',
		verbose_name='فرم'
	)
	text = models.CharField(max_length=500, verbose_name='متن سوال')
	text_fa = models.CharField(max_length=500, blank=True, null=True, verbose_name='متن فارسی سوال')
	question_type = models.CharField(
		max_length=20,
		choices=QUESTION_TYPE_CHOICES,
		default='descriptive',
		verbose_name='نوع سوال'
	)
	# برای سوالات چند گزینه‌ای، گزینه‌ها را با کاما جدا می‌کنیم
	options = models.TextField(
		blank=True,
		null=True,
		help_text='برای سوالات چند گزینه‌ای، گزینه‌ها را با کاما جدا کنید',
		verbose_name='گزینه‌ها'
	)
	options_fa = models.TextField(
		blank=True,
		null=True,
		help_text='برای سوالات چند گزینه‌ای، گزینه‌های فارسی را با کاما جدا کنید',
		verbose_name='گزینه‌های فارسی'
	)
	is_required = models.BooleanField(default=True, verbose_name='اجباری')
	is_active = models.BooleanField(default=True, verbose_name='فعال')
	order = models.PositiveIntegerField(default=0, verbose_name='ترتیب')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'سوال'
		verbose_name_plural = 'سوالات'
		ordering = ['order', 'id']

	def __str__(self):
		return self.text_fa or self.text or f"Question {self.id}"

	def get_options_list(self):
		"""تبدیل گزینه‌ها به لیست"""
		if self.options_fa:
			return [opt.strip() for opt in self.options_fa.split(',') if opt.strip()]
		elif self.options:
			return [opt.strip() for opt in self.options.split(',') if opt.strip()]
		return []


class FormResponse(models.Model):
	form = models.ForeignKey(
		Form,
		on_delete=models.CASCADE,
		related_name='responses',
		verbose_name='فرم'
	)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='form_responses',
		verbose_name='کاربر'
	)
	psychological_issue = models.ForeignKey(
		PsychologicalIssue,
		on_delete=models.CASCADE,
		related_name='responses',
		verbose_name='مسئله روانشناختی'
	)
	is_group_therapy = models.BooleanField(default=False, verbose_name='درمان گروهی')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'پاسخ فرم'
		verbose_name_plural = 'پاسخ‌های فرم'
		ordering = ['-created_at']
		# Removed unique_together to allow multiple submissions

	def __str__(self):
		return f"Response to {self.form} by {self.user.username}"


class QuestionResponse(models.Model):
	form_response = models.ForeignKey(
		FormResponse,
		on_delete=models.CASCADE,
		related_name='question_responses',
		verbose_name='پاسخ فرم'
	)
	question = models.ForeignKey(
		Question,
		on_delete=models.CASCADE,
		related_name='responses',
		verbose_name='سوال'
	)
	answer_text = models.TextField(blank=True, null=True, verbose_name='پاسخ متنی')
	answer_number = models.FloatField(blank=True, null=True, verbose_name='پاسخ عددی')
	answer_boolean = models.BooleanField(blank=True, null=True, verbose_name='پاسخ بله/خیر')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		verbose_name = 'پاسخ سوال'
		verbose_name_plural = 'پاسخ‌های سوالات'
		unique_together = [['form_response', 'question']]

	def __str__(self):
		return f"Response to {self.question}: {self.get_answer_display()}"

	def get_answer_display(self):
		"""نمایش پاسخ بر اساس نوع سوال"""
		if self.question.question_type == 'yes_no':
			return 'بله' if self.answer_boolean else 'خیر'
		elif self.question.question_type == 'number':
			return str(self.answer_number) if self.answer_number is not None else ''
		else:
			return self.answer_text or ''


class UserProfile(models.Model):
	GENDER_CHOICES = [
		('M', 'مرد'),
		('F', 'زن'),
		('O', 'سایر'),
	]

	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='profile',
		verbose_name='کاربر'
	)
	first_name = models.CharField(max_length=100, blank=True, null=True, verbose_name='نام')
	last_name = models.CharField(max_length=100, blank=True, null=True, verbose_name='نام خانوادگی')
	date_of_birth = models.DateField(blank=True, null=True, verbose_name='تاریخ تولد')
	gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True, null=True, verbose_name='جنسیت')
	phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='شماره تماس')
	email = models.EmailField(blank=True, null=True, verbose_name='ایمیل')
	address = models.TextField(blank=True, null=True, verbose_name='آدرس')
	city = models.CharField(max_length=100, blank=True, null=True, verbose_name='شهر')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'پروفایل کاربر'
		verbose_name_plural = 'پروفایل‌های کاربران'
		ordering = ['user__username']

	def __str__(self):
		if self.first_name and self.last_name:
			return f"{self.first_name} {self.last_name}"
		return self.user.username

	def is_complete(self):
		"""بررسی کامل بودن پروفایل"""
		required_fields = ['first_name', 'last_name', 'date_of_birth', 'gender']
		for field in required_fields:
			value = getattr(self, field)
			if not value:
				return False
		return True

	def get_missing_fields(self):
		"""دریافت فیلدهای خالی"""
		missing = []
		field_names = {
			'first_name': 'نام',
			'last_name': 'نام خانوادگی',
			'date_of_birth': 'تاریخ تولد',
			'gender': 'جنسیت',
		}
		for field, label in field_names.items():
			value = getattr(self, field)
			if not value:
				missing.append(label)
		return missing


class Wallet(models.Model):
	"""کیف پول کاربر"""
	CURRENCY_IRR = 'IRR'
	CURRENCY_CHOICES = [
		(CURRENCY_IRR, 'ریال'),
	]

	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='wallet',
		verbose_name='کاربر'
	)
	balance = models.BigIntegerField(default=0, verbose_name='موجودی')
	reserved_balance = models.BigIntegerField(default=0, verbose_name='موجودی بلوکه شده')
	currency = models.CharField(max_length=10, choices=CURRENCY_CHOICES, default=CURRENCY_IRR)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'کیف پول'
		verbose_name_plural = 'کیف پول‌ها'

	def __str__(self):
		return f"Wallet({self.user.username})"

	@property
	def available_balance(self):
		return max(self.balance, 0)


class WalletTransaction(models.Model):
	"""تراکنش‌های کیف پول (دفتر کل)"""
	TYPE_CREDIT = 'CREDIT'
	TYPE_DEBIT = 'DEBIT'
	TYPE_HOLD = 'HOLD'
	TYPE_RELEASE = 'RELEASE'
	TYPE_TRANSFER_IN = 'TRANSFER_IN'
	TYPE_TRANSFER_OUT = 'TRANSFER_OUT'
	TYPE_ADJUSTMENT = 'ADJUSTMENT'

	TRANSACTION_TYPE_CHOICES = [
		(TYPE_CREDIT, 'واریز'),
		(TYPE_DEBIT, 'برداشت'),
		(TYPE_HOLD, 'بلوکه'),
		(TYPE_RELEASE, 'آزادسازی'),
		(TYPE_TRANSFER_IN, 'انتقال ورودی'),
		(TYPE_TRANSFER_OUT, 'انتقال خروجی'),
		(TYPE_ADJUSTMENT, 'اصلاح موجودی'),
	]

	wallet = models.ForeignKey(
		Wallet,
		on_delete=models.CASCADE,
		related_name='transactions',
		verbose_name='کیف پول'
	)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='wallet_transactions',
		verbose_name='کاربر'
	)
	session_request = models.ForeignKey(
		'SessionRequest',
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='wallet_transactions',
		verbose_name='درخواست جلسه'
	)
	transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPE_CHOICES)
	amount = models.BigIntegerField(verbose_name='مبلغ')
	currency = models.CharField(max_length=10, default=Wallet.CURRENCY_IRR)
	description = models.CharField(max_length=255, blank=True, null=True, verbose_name='توضیحات')
	balance_after = models.BigIntegerField(default=0, verbose_name='موجودی پس از تراکنش')
	metadata = models.JSONField(default=dict, blank=True, verbose_name='اطلاعات اضافی')
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		verbose_name = 'تراکنش کیف پول'
		verbose_name_plural = 'تراکنش‌های کیف پول'
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['user', '-created_at']),
			models.Index(fields=['session_request', '-created_at']),
		]

	def __str__(self):
		return f"{self.user.username} - {self.transaction_type} - {self.amount}"


class SessionRequest(models.Model):
	STATUS_CHOICES = [
		('PENDING_PAYMENT', 'در انتظار پرداخت'),
		('PENDING', 'در انتظار درمانگر'),
		('APPROVED', 'تایید شده'),
		('DENIED', 'رد شده'),
		('CANCELLED', 'لغو شده'),
	]

	PAYMENT_STATUS_CHOICES = [
		('PENDING', 'در انتظار پرداخت'),
		('HELD', 'بلوکه شده'),
		('PAID', 'واریز شده'),
		('RELEASED', 'برگشت داده شده'),
		('NOT_REQUIRED', 'نیاز به پرداخت ندارد'),
	]

	form_response = models.ForeignKey(
		FormResponse,
		on_delete=models.CASCADE,
		related_name='session_requests',
		verbose_name='پاسخ فرم اصلی',
		null=True,
		blank=True,
		help_text='پاسخ فرم نماینده برای درخواست (برای درمان گروهی، می‌تواند null باشد)'
	)
	patient = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='session_requests',
		verbose_name='بیمار اصلی',
		null=True,
		blank=True,
		help_text='بیمار اصلی (برای سازگاری با نسخه قبلی). برای درمان گروهی از patients استفاده کنید.'
	)
	patients = models.ManyToManyField(
		settings.AUTH_USER_MODEL,
		related_name='group_session_requests',
		verbose_name='بیماران',
		help_text='لیست بیماران در این درخواست (برای درمان گروهی)'
	)
	is_group_therapy = models.BooleanField(default=False, verbose_name='درمان گروهی')
	psychological_issue = models.ForeignKey(
		PsychologicalIssue,
		on_delete=models.CASCADE,
		related_name='session_requests',
		verbose_name='مسئله روانشناختی'
	)
	status = models.CharField(
		max_length=20,
		choices=STATUS_CHOICES,
		default='PENDING_PAYMENT',
		verbose_name='وضعیت'
	)
	price = models.BigIntegerField(default=0, verbose_name='مبلغ جلسه')
	price_currency = models.CharField(max_length=10, default='IRR', verbose_name='واحد پولی')
	payment_status = models.CharField(
		max_length=20,
		choices=PAYMENT_STATUS_CHOICES,
		default='PENDING',
		verbose_name='وضعیت پرداخت'
	)
	approved_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='approved_requests',
		verbose_name='تایید کننده'
	)
	denied_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='denied_requests',
		verbose_name='رد کننده'
	)
	# Patient choice after therapist approval
	patient_choice = models.CharField(
		max_length=10,
		choices=[
			('PENDING', 'در انتظار انتخاب'),
			('ACCEPTED', 'تایید شده توسط بیمار'),
			('REJECTED', 'رد شده توسط بیمار'),
		],
		default='PENDING',
		verbose_name='انتخاب بیمار'
	)
	patient_accepted_at = models.DateTimeField(null=True, blank=True, verbose_name='تاریخ تایید بیمار')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'درخواست جلسه'
		verbose_name_plural = 'درخواست‌های جلسه'
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['status', '-created_at']),
		]

	def __str__(self):
		patient_username = self.patient.username if self.patient else "unknown"
		return f"Session Request {self.id} - {patient_username} - {self.status}"


class TherapistOffer(models.Model):
	STATUS_CHOICES = [
		('PENDING', 'در انتظار پیشنهاد'),
		('ACCEPTED', 'تایید شده'),
		('REJECTED', 'رد شده'),
	]

	session_request = models.ForeignKey(
		SessionRequest,
		on_delete=models.CASCADE,
		related_name='offers',
		verbose_name='درخواست جلسه'
	)
	therapist = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='therapist_offers',
		verbose_name='درمانگر'
	)
	price = models.BigIntegerField(default=0, verbose_name='قیمت پیشنهادی')
	message = models.TextField(blank=True, null=True, verbose_name='پیام تراپیست')
	status = models.CharField(
		max_length=20,
		choices=STATUS_CHOICES,
		default='PENDING',
		verbose_name='وضعیت'
	)
	created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
	updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ بروزرسانی')

	class Meta:
		verbose_name = 'پیشنهاد تراپیست'
		verbose_name_plural = 'پیشنهادهای تراپیست'
		ordering = ['-created_at']
		unique_together = [['session_request', 'therapist']]
		indexes = [
			models.Index(fields=['session_request', 'therapist']),
		]

	def __str__(self):
		return f"TherapistOffer {self.id} - Request {self.session_request_id} - {self.therapist.username}"


class TherapistProfile(models.Model):
	"""پروفایل تراپیست که باید توسط admin تأیید شود"""
	user = models.OneToOneField(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='therapist_profile',
		verbose_name='کاربر'
	)
	
	# اطلاعات شخصی
	first_name = models.CharField(max_length=100, verbose_name='نام')
	last_name = models.CharField(max_length=100, verbose_name='نام خانوادگی')
	bio = models.TextField(blank=True, null=True, verbose_name='بیوگرافی')
	profile_image = models.ImageField(
		upload_to='therapist_profiles/',
		storage=LiaraMediaStorage() if LiaraMediaStorage else None,
		blank=True,
		null=True,
		verbose_name='تصویر پروفایل'
	)
	activity_categories = models.ManyToManyField(
		Category,
		blank=True,
		related_name='therapist_profiles',
		verbose_name='حوزه های فعالیت'
	)
	
	# اطلاعات حرفه‌ای
	specializations = models.JSONField(
		default=list,
		blank=True,
		help_text='لیست تخصص‌ها به صورت JSON array',
		verbose_name='تخصص‌ها'
	)
	years_of_experience = models.PositiveIntegerField(
		blank=True,
		null=True,
		verbose_name='سال‌های تجربه'
	)
	education = models.TextField(blank=True, null=True, verbose_name='تحصیلات')
	certificates = models.JSONField(
		default=list,
		blank=True,
		help_text='لیست گواهینامه‌ها به صورت JSON array',
		verbose_name='گواهینامه‌ها'
	)
	
	# اطلاعات تماس (اختیاری)
	phone = models.CharField(max_length=20, blank=True, null=True, verbose_name='شماره تماس')
	email = models.EmailField(blank=True, null=True, verbose_name='ایمیل')
	address = models.TextField(blank=True, null=True, verbose_name='آدرس')
	city = models.CharField(max_length=100, blank=True, null=True, verbose_name='شهر')
	
	# وضعیت تأیید
	is_approved = models.BooleanField(default=False, verbose_name='تأیید شده')
	approved_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='approved_therapist_profiles',
		verbose_name='تأیید کننده'
	)
	approved_at = models.DateTimeField(null=True, blank=True, verbose_name='تاریخ تأیید')
	rejection_reason = models.TextField(
		blank=True,
		null=True,
		verbose_name='دلیل رد'
	)
	
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	
	class Meta:
		verbose_name = 'پروفایل تراپیست'
		verbose_name_plural = 'پروفایل‌های تراپیست‌ها'
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['is_approved', '-created_at']),
		]
	
	def __str__(self):
		return f"{self.first_name} {self.last_name} - {'تأیید شده' if self.is_approved else 'در انتظار تأیید'}"
	
	def get_full_name(self):
		return f"{self.first_name} {self.last_name}"


class TherapySession(models.Model):
	"""جلسه درمانی که بعد از تایید بیمار از درمانگر شروع می‌شود"""
	session_request = models.OneToOneField(
		SessionRequest,
		on_delete=models.CASCADE,
		related_name='therapy_session',
		verbose_name='درخواست جلسه'
	)
	patient = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='therapy_sessions_as_patient',
		verbose_name='بیمار اصلی',
		null=True,
		blank=True,
		help_text='بیمار اصلی (برای سازگاری با نسخه قبلی). برای درمان گروهی از patients استفاده کنید.'
	)
	patients = models.ManyToManyField(
		settings.AUTH_USER_MODEL,
		related_name='group_therapy_sessions',
		verbose_name='بیماران',
		help_text='لیست بیماران در این جلسه درمانی (برای درمان گروهی)'
	)
	therapist = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='therapy_sessions_as_therapist',
		verbose_name='درمانگر'
	)
	is_group_therapy = models.BooleanField(default=False, verbose_name='درمان گروهی')
	started_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ شروع')
	ended_at = models.DateTimeField(null=True, blank=True, verbose_name='تاریخ پایان')
	is_active = models.BooleanField(default=True, verbose_name='فعال')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'جلسه درمانی'
		verbose_name_plural = 'جلسات درمانی'
		ordering = ['-started_at']
		indexes = [
			models.Index(fields=['patient', '-started_at']),
			models.Index(fields=['therapist', '-started_at']),
		]

	def __str__(self):
		return f"Therapy Session {self.id} - {self.patient.username} & {self.therapist.username}"


class ChatMessage(models.Model):
	"""پیام‌های چت بین بیمار و درمانگر"""
	MESSAGE_TYPE_CHOICES = [
		('TEXT', 'متن'),
		('VOICE', 'صدا'),
		('IMAGE', 'تصویر'),
	]

	session = models.ForeignKey(
		TherapySession,
		on_delete=models.CASCADE,
		related_name='chat_messages',
		verbose_name='جلسه درمانی'
	)
	sender = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='sent_chat_messages',
		verbose_name='ارسال کننده'
	)
	message_type = models.CharField(
		max_length=10,
		choices=MESSAGE_TYPE_CHOICES,
		default='TEXT',
		verbose_name='نوع پیام'
	)
	content = models.TextField(verbose_name='محتوا')
	voice_file = models.FileField(
		upload_to='chat_voices/',
		storage=LiaraMediaStorage() if LiaraMediaStorage else None,
		blank=True,
		null=True,
		verbose_name='فایل صوتی'
	)
	is_read = models.BooleanField(default=False, verbose_name='خوانده شده')
	created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ارسال')

	class Meta:
		verbose_name = 'پیام چت'
		verbose_name_plural = 'پیام‌های چت'
		ordering = ['created_at']
		indexes = [
			models.Index(fields=['session', 'created_at']),
			models.Index(fields=['sender', 'created_at']),
		]

	def __str__(self):
		return f"Message {self.id} from {self.sender.username} in Session {self.session.id}"


class Post(models.Model):
	"""پست‌های ایجاد شده توسط تراپیست‌ها"""
	POST_TYPE_CHOICES = [
		('TEXT', 'متن'),
		('IMAGE', 'تصویر'),
		('VIDEO', 'ویدیو'),
	]

	therapist = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='posts',
		verbose_name='تراپیست'
	)
	post_type = models.CharField(
		max_length=10,
		choices=POST_TYPE_CHOICES,
		default='TEXT',
		verbose_name='نوع پست'
	)
	content = models.TextField(verbose_name='محتوا')
	image = models.ImageField(
		upload_to='posts/images/',
		storage=LiaraMediaStorage() if LiaraMediaStorage else None,
		blank=True,
		null=True,
		verbose_name='تصویر'
	)
	video = models.FileField(
		upload_to='posts/videos/',
		storage=LiaraMediaStorage() if LiaraMediaStorage else None,
		blank=True,
		null=True,
		verbose_name='ویدیو'
	)
	is_active = models.BooleanField(default=True, verbose_name='فعال')
	created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')
	updated_at = models.DateTimeField(auto_now=True, verbose_name='تاریخ بروزرسانی')

	class Meta:
		verbose_name = 'پست'
		verbose_name_plural = 'پست‌ها'
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['is_active', '-created_at']),
			models.Index(fields=['therapist', '-created_at']),
		]

	def __str__(self):
		therapist_name = self.get_therapist_name()
		return f"Post {self.id} by {therapist_name} - {self.get_post_type_display()}"

	def get_therapist_name(self):
		"""دریافت نام تراپیست"""
		if hasattr(self.therapist, 'therapist_profile'):
			profile = self.therapist.therapist_profile
			return f"{profile.first_name} {profile.last_name}"
		return self.therapist.username

	def get_reactions_count(self):
		"""تعداد کل واکنش‌ها"""
		return self.reactions.count()

	def get_reactions_by_type(self):
		"""تعداد واکنش‌ها بر اساس نوع"""
		from django.db.models import Count
		return self.reactions.values('reaction_type').annotate(count=Count('id'))


class PostReaction(models.Model):
	"""واکنش‌های کاربران به پست‌ها"""
	REACTION_TYPE_CHOICES = [
		('LIKE', '👍 لایک'),
		('LOVE', '❤️ عشق'),
		('SUPPORT', '🤝 حمایت'),
		('THANKS', '🙏 تشکر'),
		('INSIGHTFUL', '💡 بینش'),
	]

	post = models.ForeignKey(
		Post,
		on_delete=models.CASCADE,
		related_name='reactions',
		verbose_name='پست'
	)
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='post_reactions',
		verbose_name='کاربر'
	)
	reaction_type = models.CharField(
		max_length=20,
		choices=REACTION_TYPE_CHOICES,
		default='LIKE',
		verbose_name='نوع واکنش'
	)
	created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ایجاد')

	class Meta:
		verbose_name = 'واکنش پست'
		verbose_name_plural = 'واکنش‌های پست‌ها'
		unique_together = [['post', 'user']]  # هر کاربر فقط یک واکنش به هر پست
		indexes = [
			models.Index(fields=['post', 'user']),
			models.Index(fields=['post', 'reaction_type']),
		]

	def __str__(self):
		return f"{self.user.username} - {self.get_reaction_type_display()} on Post {self.post.id}"


class DeviceToken(models.Model):
	"""توکن دستگاه برای ارسال نوتیفیکیشن‌های پوش"""
	DEVICE_TYPE_CHOICES = [
		('ios', 'iOS'),
		('android', 'Android'),
		('web', 'Web'),
	]

	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='device_tokens',
		verbose_name='کاربر'
	)
	token = models.CharField(max_length=255, unique=True, verbose_name='توکن دستگاه')
	device_type = models.CharField(
		max_length=10,
		choices=DEVICE_TYPE_CHOICES,
		verbose_name='نوع دستگاه'
	)
	device_name = models.CharField(max_length=100, blank=True, null=True, verbose_name='نام دستگاه')
	is_active = models.BooleanField(default=True, verbose_name='فعال')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)

	class Meta:
		verbose_name = 'توکن دستگاه'
		verbose_name_plural = 'توکن‌های دستگاه‌ها'
		ordering = ['-created_at']
		indexes = [
			models.Index(fields=['user', 'is_active']),
			models.Index(fields=['token']),
		]

	def __str__(self):
		device_info = f"{self.get_device_type_display()}"
		if self.device_name:
			device_info += f" - {self.device_name}"
		return f"{self.user.username} - {device_info}"


class Notification(models.Model):
	"""نوتیفیکیشن‌های ارسال شده"""
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='notifications',
		verbose_name='کاربر'
	)
	title = models.CharField(max_length=200, verbose_name='عنوان')
	message = models.TextField(verbose_name='پیام')
	sent_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.SET_NULL,
		null=True,
		blank=True,
		related_name='sent_notifications',
		verbose_name='ارسال کننده'
	)
	sent_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ارسال')
	is_read = models.BooleanField(default=False, verbose_name='خوانده شده')
	read_at = models.DateTimeField(null=True, blank=True, verbose_name='تاریخ خواندن')

	class Meta:
		verbose_name = 'نوتیفیکیشن'
		verbose_name_plural = 'نوتیفیکیشن‌ها'
		ordering = ['-sent_at']
		indexes = [
			models.Index(fields=['user', '-sent_at']),
			models.Index(fields=['user', 'is_read']),
		]

	def __str__(self):
		return f"{self.title} - {self.user.username}"


class SupportChat(models.Model):
	"""پیام‌های چت پشتیبانی بین کاربر و تیم پشتیبانی"""
	MESSAGE_TYPE_CHOICES = [
		('TEXT', 'متن'),
		('VOICE', 'صدا'),
		('IMAGE', 'تصویر'),
	]

	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='support_chat_messages',
		verbose_name='کاربر'
	)
	sender = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='sent_support_messages',
		verbose_name='ارسال کننده'
	)
	is_support_staff = models.BooleanField(
		default=False,
		verbose_name='کارمند پشتیبانی',
		help_text='اگر True باشد، پیام از طرف تیم پشتیبانی است'
	)
	message_type = models.CharField(
		max_length=10,
		choices=MESSAGE_TYPE_CHOICES,
		default='TEXT',
		verbose_name='نوع پیام'
	)
	content = models.TextField(verbose_name='محتوا')
	voice_file = models.FileField(
		upload_to='support_chat_voices/',
		storage=LiaraMediaStorage() if LiaraMediaStorage else None,
		blank=True,
		null=True,
		verbose_name='فایل صوتی'
	)
	is_read = models.BooleanField(default=False, verbose_name='خوانده شده')
	created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاریخ ارسال')

	class Meta:
		verbose_name = 'پیام پشتیبانی'
		verbose_name_plural = 'پیام‌های پشتیبانی'
		ordering = ['created_at']
		indexes = [
			models.Index(fields=['user', 'created_at']),
			models.Index(fields=['sender', 'created_at']),
			models.Index(fields=['user', 'is_read']),
		]

	def __str__(self):
		sender_type = 'پشتیبانی' if self.is_support_staff else 'کاربر'
		return f"Support Message {self.id} from {sender_type} (User: {self.user.username})"
