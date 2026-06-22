from django.apps import AppConfig
from django.conf import settings

# Default wallet bootstrap values (can be overridden via Django settings)
INITIAL_WALLET_CREDIT = getattr(settings, "INITIAL_WALLET_CREDIT", 2_000_000)
INITIAL_WALLET_DESCRIPTION = getattr(
	settings,
	"INITIAL_WALLET_DESCRIPTION",
	"اعتبار اولیه ثبت نام",
)
ADMIN_WALLET_USERNAME = getattr(settings, "ADMIN_WALLET_USERNAME", "admin")


class AuthappConfig(AppConfig):
	default_auto_field = "django.db.models.BigAutoField"
	name = "authapp"

	def ready(self):
		from django.db import OperationalError, ProgrammingError
		from django.db.models.signals import post_save
		from django.contrib.auth import get_user_model
		
		def create_user_profile(sender, instance, created, **kwargs):
			"""ایجاد خودکار پروفایل هنگام ساخت کاربر جدید"""
			if created:
				UserProfile = self.get_model('UserProfile')
				UserProfile.objects.get_or_create(user=instance)
		
		def create_user_wallet(sender, instance, created, **kwargs):
			"""ایجاد خودکار کیف پول با اعتبار اولیه"""
			if not created:
				return
			
			Wallet = self.get_model('Wallet')
			WalletTransaction = self.get_model('WalletTransaction')
			
			# Create wallet if it doesn't exist
			wallet, wallet_created = Wallet.objects.get_or_create(user=instance)
			
			# Add initial credit only once at creation time
			if wallet_created:
				initial_credit = INITIAL_WALLET_CREDIT
				wallet.balance = initial_credit
				wallet.reserved_balance = 0
				wallet.save(update_fields=['balance', 'reserved_balance'])
				
				WalletTransaction.objects.create(
					wallet=wallet,
					user=instance,
					transaction_type=WalletTransaction.TYPE_CREDIT,
					amount=initial_credit,
					description=INITIAL_WALLET_DESCRIPTION,
					balance_after=wallet.balance,
					metadata={'source': 'signup_bonus'}
				)
		
		def ensure_admin_wallet_exists():
			"""Ensure the admin wallet exists for the configured admin user."""
			User = get_user_model()
			admin_user = User.objects.filter(username=ADMIN_WALLET_USERNAME, is_active=True).first()
			if not admin_user:
				admin_user = User.objects.filter(is_superuser=True, is_active=True).first()
			if not admin_user:
				admin_user = User.objects.filter(is_staff=True, is_active=True).first()
			if not admin_user:
				return

			Wallet = self.get_model('Wallet')
			WalletTransaction = self.get_model('WalletTransaction')
			wallet, wallet_created = Wallet.objects.get_or_create(user=admin_user)
			if wallet_created:
				wallet.balance = 0
				wallet.reserved_balance = 0
				wallet.save(update_fields=['balance', 'reserved_balance'])
				WalletTransaction.objects.create(
					wallet=wallet,
					user=admin_user,
					transaction_type=WalletTransaction.TYPE_CREDIT,
					amount=0,
					description='ایجاد کیف پول ادمین',
					balance_after=wallet.balance,
					metadata={'source': 'admin_wallet_bootstrap'}
				)

		User = get_user_model()
		post_save.connect(create_user_profile, sender=User)
		post_save.connect(create_user_wallet, sender=User)
		try:
			ensure_admin_wallet_exists()
		except (OperationalError, ProgrammingError):
			# Database tables may not exist yet while running initial migrations.
			pass



