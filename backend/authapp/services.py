"""
سرویس ارسال نوتیفیکیشن پوش
"""
import requests
import logging
from typing import Dict, List, Optional
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import DeviceToken, Notification

logger = logging.getLogger(__name__)
User = get_user_model()

# Expo Push Notification API endpoint
EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"


class PushNotificationService:
	"""سرویس ارسال نوتیفیکیشن پوش از طریق Expo"""
	
	def __init__(self):
		self.api_url = EXPO_PUSH_API_URL
	
	def send_notification(
		self,
		tokens: List[str],
		title: str,
		message: str,
		data: Optional[Dict] = None,
		sound: str = "default",
		priority: str = "default",
		badge: Optional[int] = None
	) -> Dict:
		"""
		ارسال نوتیفیکیشن به لیست توکن‌ها
		
		Args:
			tokens: لیست توکن‌های Expo
			title: عنوان نوتیفیکیشن
			message: متن پیام
			data: داده‌های اضافی (اختیاری)
			sound: صدای نوتیفیکیشن
			priority: اولویت (default, normal, high)
			badge: شماره badge (برای iOS)
		
		Returns:
			Dict با کلیدهای success و results
		"""
		if not tokens:
			return {
				'success': False,
				'error': 'هیچ توکنی ارائه نشده است'
			}
		
		# ساخت پیام‌های Expo
		messages = []
		for token in tokens:
			message_data = {
				'to': token,
				'sound': sound,
				'title': title,
				'body': message,
				'priority': priority,
				'data': data or {}
			}
			
			if badge is not None:
				message_data['badge'] = badge
			
			messages.append(message_data)
		
		try:
			# ارسال درخواست به Expo
			response = requests.post(
				self.api_url,
				json=messages,
				headers={
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'Accept-Encoding': 'gzip, deflate'
				},
				timeout=10
			)
			
			response.raise_for_status()
			results = response.json().get('data', [])
			
			# بررسی نتایج
			success_count = 0
			fail_count = 0
			errors = []
			
			for result in results:
				if result.get('status') == 'ok':
					success_count += 1
				else:
					fail_count += 1
					error_detail = result.get('message', 'Unknown error')
					errors.append(error_detail)
					logger.warning(f"Failed to send notification: {error_detail}")
			
			return {
				'success': success_count > 0,
				'success_count': success_count,
				'fail_count': fail_count,
				'errors': errors,
				'results': results
			}
		
		except requests.exceptions.RequestException as e:
			logger.error(f"Error sending push notification: {str(e)}")
			return {
				'success': False,
				'error': f'خطا در ارسال نوتیفیکیشن: {str(e)}'
			}
	
	def send_notification_to_user(
		self,
		user: User,
		title: str,
		message: str,
		data: Optional[Dict] = None,
		sent_by: Optional[User] = None
	) -> Dict:
		"""
		ارسال نوتیفیکیشن به یک کاربر خاص
		
		Args:
			user: کاربر هدف
			title: عنوان نوتیفیکیشن
			message: متن پیام
			data: داده‌های اضافی
			sent_by: کاربر ارسال‌کننده (اختیاری)
		
		Returns:
			Dict با نتیجه ارسال
		"""
		# دریافت توکن‌های فعال کاربر
		device_tokens = DeviceToken.objects.filter(
			user=user,
			is_active=True
		).values_list('token', flat=True)
		
		if not device_tokens:
			# ذخیره نوتیفیکیشن حتی اگر توکنی وجود نداشته باشد
			Notification.objects.create(
				user=user,
				title=title,
				message=message,
				sent_by=sent_by,
				is_read=False
			)
			return {
				'success': False,
				'error': 'کاربر هیچ دستگاه فعالی ندارد',
				'notification_saved': True
			}
		
		# ارسال نوتیفیکیشن
		result = self.send_notification(
			tokens=list(device_tokens),
			title=title,
			message=message,
			data=data
		)
		
		# ذخیره نوتیفیکیشن در دیتابیس
		Notification.objects.create(
			user=user,
			title=title,
			message=message,
			sent_by=sent_by,
			is_read=False
		)
		
		return result
	
	def send_notification_to_multiple_users(
		self,
		users: List[User],
		title: str,
		message: str,
		data: Optional[Dict] = None,
		sent_by: Optional[User] = None
	) -> Dict:
		"""
		ارسال نوتیفیکیشن به چند کاربر
		
		Args:
			users: لیست کاربران
			title: عنوان نوتیفیکیشن
			message: متن پیام
			data: داده‌های اضافی
			sent_by: کاربر ارسال‌کننده
		
		Returns:
			Dict با آمار ارسال
		"""
		all_tokens = []
		user_token_map = {}  # نگاشت توکن به کاربر برای ذخیره نوتیفیکیشن
		
		# جمع‌آوری توکن‌های همه کاربران
		for user in users:
			tokens = DeviceToken.objects.filter(
				user=user,
				is_active=True
			).values_list('token', flat=True)
			
			for token in tokens:
				all_tokens.append(token)
				if token not in user_token_map:
					user_token_map[token] = []
				user_token_map[token].append(user)
		
		if not all_tokens:
			# ذخیره نوتیفیکیشن برای همه کاربران
			for user in users:
				Notification.objects.create(
					user=user,
					title=title,
					message=message,
					sent_by=sent_by,
					is_read=False
				)
			return {
				'success': False,
				'error': 'هیچ دستگاه فعالی یافت نشد',
				'notification_saved': True
			}
		
		# ارسال نوتیفیکیشن
		result = self.send_notification(
			tokens=all_tokens,
			title=title,
			message=message,
			data=data
		)
		
		# ذخیره نوتیفیکیشن برای همه کاربران
		for user in users:
			Notification.objects.create(
				user=user,
				title=title,
				message=message,
				sent_by=sent_by,
				is_read=False
			)
		
		return result

