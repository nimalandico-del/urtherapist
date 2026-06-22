import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.conf import settings

User = None

def get_user_model_lazy():
	global User
	if User is None:
		User = get_user_model()
	return User


class TherapistRequestConsumer(AsyncWebsocketConsumer):
	async def connect(self):
		# Authenticate user via JWT token
		query_string = self.scope.get('query_string', b'').decode()
		token = None
		for param in query_string.split('&'):
			if param.startswith('token='):
				token = param.split('=')[1]
				# URL decode token
				import urllib.parse
				token = urllib.parse.unquote(token)
				break
		
		if not token:
			await self.close()
			return
		
		try:
			# Import JWT utilities here to avoid Django setup issues
			from rest_framework_simplejwt.tokens import UntypedToken
			from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
			from jwt import decode as jwt_decode
			
			# Validate token
			UntypedToken(token)
			decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
			user_id = decoded_data.get('user_id')
			
			if user_id:
				User = get_user_model_lazy()
				user = await self.get_user(user_id)
				if user:
					self.user = user
					self.room_group_name = 'therapist_requests'
					
					# Join room group
					await self.channel_layer.group_add(
						self.room_group_name,
						self.channel_name
					)
					
					await self.accept()
					return
		
		except Exception as e:
			print(f"WebSocket authentication error: {e}")
		
		await self.close()
	
	async def disconnect(self, close_code):
		# Leave room group
		if hasattr(self, 'room_group_name'):
			await self.channel_layer.group_discard(
				self.room_group_name,
				self.channel_name
			)
	
	async def receive(self, text_data):
		"""Receive message from WebSocket"""
		pass
	
	async def new_request(self, event):
		"""Send new request to WebSocket"""
		await self.send(text_data=json.dumps({
			'type': 'new_request',
			'data': event['data']
		}))
	
	async def request_updated(self, event):
		"""Send updated request to WebSocket"""
		await self.send(text_data=json.dumps({
			'type': 'request_updated',
			'data': event['data']
		}))
	
	@database_sync_to_async
	def get_user(self, user_id):
		try:
			User = get_user_model_lazy()
			return User.objects.get(id=user_id)
		except User.DoesNotExist:
			return None


class PatientNotificationConsumer(AsyncWebsocketConsumer):
	"""WebSocket consumer for patient notifications"""
	async def connect(self):
		# Authenticate user via JWT token
		query_string = self.scope.get('query_string', b'').decode()
		token = None
		for param in query_string.split('&'):
			if param.startswith('token='):
				token = param.split('=')[1]
				import urllib.parse
				token = urllib.parse.unquote(token)
				break
		
		if not token:
			await self.close()
			return
		
		try:
			from rest_framework_simplejwt.tokens import UntypedToken
			from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
			from jwt import decode as jwt_decode
			
			# Validate token
			UntypedToken(token)
			decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
			user_id = decoded_data.get('user_id')
			
			if user_id:
				User = get_user_model_lazy()
				user = await self.get_user(user_id)
				if user:
					self.user = user
					# Join patient-specific group
					self.room_group_name = f'patient_{user_id}_notifications'
					
					await self.channel_layer.group_add(
						self.room_group_name,
						self.channel_name
					)
					
					await self.accept()
					return
		
		except Exception as e:
			print(f"Patient WebSocket authentication error: {e}")
		
		await self.close()
	
	async def disconnect(self, close_code):
		if hasattr(self, 'room_group_name'):
			await self.channel_layer.group_discard(
				self.room_group_name,
				self.channel_name
			)
	
	async def receive(self, text_data):
		"""Receive message from WebSocket"""
		pass
	
	async def therapist_approved(self, event):
		"""Send therapist approval notification to patient"""
		message = event.get('message', 'درخواست شما تایید شد')
		await self.send(text_data=json.dumps({
			'type': 'therapist_approved',
			'message': message,
			'data': event.get('data', {})
		}))

	async def therapist_proposed(self, event):
		"""Send therapist proposal notification to patient"""
		message = event.get('message', 'یک تراپیست پیشنهاد قیمت ارسال کرد')
		await self.send(text_data=json.dumps({
			'type': 'therapist_proposed',
			'message': message,
			'data': event.get('data', {})
		}))
	
	async def therapy_session_started(self, event):
		"""Send therapy session started notification to patient"""
		message = event.get('message', 'جلسه درمانی شروع شد')
		await self.send(text_data=json.dumps({
			'type': 'therapy_session_started',
			'message': message,
			'data': event.get('data', {})
		}))
	
	async def group_therapy_session_started(self, event):
		"""Send group therapy session started notification to patient"""
		message = event.get('message', 'جلسه درمانی گروهی شروع شد')
		await self.send(text_data=json.dumps({
			'type': 'group_therapy_session_started',
			'message': message,
			'data': event.get('data', {})
		}))
	
	@database_sync_to_async
	def get_user(self, user_id):
		try:
			User = get_user_model_lazy()
			return User.objects.get(id=user_id)
		except User.DoesNotExist:
			return None


class ChatConsumer(AsyncWebsocketConsumer):
	"""WebSocket consumer for chat messages"""
	async def connect(self):
		# Authenticate user via JWT token
		query_string = self.scope.get('query_string', b'').decode()
		token = None
		session_id = None
		
		for param in query_string.split('&'):
			if param.startswith('token='):
				token = param.split('=')[1]
				import urllib.parse
				token = urllib.parse.unquote(token)
			elif param.startswith('session_id='):
				session_id = param.split('=')[1]
				import urllib.parse
				session_id = urllib.parse.unquote(session_id)
		
		if not token or not session_id:
			await self.close()
			return
		
		try:
			from rest_framework_simplejwt.tokens import UntypedToken
			from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
			from jwt import decode as jwt_decode
			
			# Validate token
			UntypedToken(token)
			decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
			user_id = decoded_data.get('user_id')
			
			if user_id:
				User = get_user_model_lazy()
				user = await self.get_user_chat(user_id)
				if user:
					self.user = user
					self.session_id = int(session_id)
					
					# Verify user has access to this session
					has_access = await self.check_session_access(self.session_id, user_id)
					if not has_access:
						await self.close()
						return
					
					# Join session group
					self.room_group_name = f'chat_session_{self.session_id}'
					
					await self.channel_layer.group_add(
						self.room_group_name,
						self.channel_name
					)
					
					await self.accept()
					return
		
		except Exception as e:
			print(f"Chat WebSocket authentication error: {e}")
		
		await self.close()
	
	async def disconnect(self, close_code):
		if hasattr(self, 'room_group_name'):
			await self.channel_layer.group_discard(
				self.room_group_name,
				self.channel_name
			)
	
	async def receive(self, text_data):
		"""Receive message from WebSocket"""
		try:
			data = json.loads(text_data)
			message_type = data.get('type')
			
			if message_type == 'read_messages':
				# Mark messages as read
				await self.mark_messages_as_read()
		except Exception as e:
			print(f"Error processing WebSocket message: {e}")
	
	async def chat_message(self, event):
		"""Send chat message to WebSocket"""
		await self.send(text_data=json.dumps({
			'type': 'chat_message',
			'data': event['data']
		}))

	async def session_started(self, event):
		"""Send session started notification"""
		await self.send(text_data=json.dumps({
			'type': 'session_started',
			'data': event['data']
		}))

	async def session_ended(self, event):
		"""Send session ended notification"""
		await self.send(text_data=json.dumps({
			'type': 'session_ended',
			'data': event['data']
		}))

	@database_sync_to_async
	def check_session_access(self, session_id, user_id):
		"""Check if user has access to this therapy session"""
		try:
			from .models import TherapySession
			session = TherapySession.objects.prefetch_related('patients').get(id=session_id)
			# Check if user is therapist
			if session.therapist.id == user_id:
				return True
			# Check if user is patient (for group therapy, check ManyToMany)
			if session.is_group_therapy:
				return user_id in [p.id for p in session.patients.all()]
			else:
				return session.patient and session.patient.id == user_id
		except Exception:
			return False
	
	@database_sync_to_async
	def mark_messages_as_read(self):
		"""Mark messages as read"""
		try:
			from .models import TherapySession, ChatMessage
			from django.db.models import Q
			session = TherapySession.objects.get(id=self.session_id)
			ChatMessage.objects.filter(
				~Q(sender_id=self.user.id),
				session=session,
				is_read=False
			).update(is_read=True)
		except Exception as e:
			print(f"Error marking messages as read: {e}")
	
	@database_sync_to_async
	def get_user_chat(self, user_id):
		try:
			User = get_user_model_lazy()
			return User.objects.get(id=user_id)
		except User.DoesNotExist:
			return None


class SupportChatConsumer(AsyncWebsocketConsumer):
	"""WebSocket consumer for support chat messages"""
	async def connect(self):
		# Authenticate user via JWT token
		query_string = self.scope.get('query_string', b'').decode()
		token = None
		
		for param in query_string.split('&'):
			if param.startswith('token='):
				token = param.split('=')[1]
				import urllib.parse
				token = urllib.parse.unquote(token)
				break
		
		if not token:
			await self.close()
			return
		
		try:
			from rest_framework_simplejwt.tokens import UntypedToken
			from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
			from jwt import decode as jwt_decode
			
			# Validate token
			UntypedToken(token)
			decoded_data = jwt_decode(token, settings.SECRET_KEY, algorithms=["HS256"])
			user_id = decoded_data.get('user_id')
			
			if user_id:
				User = get_user_model_lazy()
				user = await self.get_user_support(user_id)
				if user:
					self.user = user
					# Join user-specific support chat group
					self.room_group_name = f'support_chat_{user_id}'
					
					await self.channel_layer.group_add(
						self.room_group_name,
						self.channel_name
					)
					
					await self.accept()
					return
		
		except Exception as e:
			print(f"Support Chat WebSocket authentication error: {e}")
		
		await self.close()
	
	async def disconnect(self, close_code):
		if hasattr(self, 'room_group_name'):
			await self.channel_layer.group_discard(
				self.room_group_name,
				self.channel_name
			)
	
	async def receive(self, text_data):
		"""Receive message from WebSocket"""
		try:
			data = json.loads(text_data)
			message_type = data.get('type')
			
			if message_type == 'read_messages':
				# Mark messages as read
				await self.mark_messages_as_read()
		except Exception as e:
			print(f"Error processing Support Chat WebSocket message: {e}")
	
	async def support_message(self, event):
		"""Send support chat message to WebSocket"""
		await self.send(text_data=json.dumps({
			'type': 'support_message',
			'data': event['data']
		}))
	
	@database_sync_to_async
	def mark_messages_as_read(self):
		"""Mark support messages as read"""
		try:
			from .models import SupportChat
			from django.db.models import Q
			SupportChat.objects.filter(
				~Q(sender_id=self.user.id),
				user=self.user,
				is_read=False
			).update(is_read=True)
		except Exception as e:
			print(f"Error marking support messages as read: {e}")
	
	@database_sync_to_async
	def get_user_support(self, user_id):
		try:
			User = get_user_model_lazy()
			return User.objects.get(id=user_id)
		except User.DoesNotExist:
			return None


