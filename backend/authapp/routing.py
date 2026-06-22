from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
	re_path(r'ws/therapist/requests/$', consumers.TherapistRequestConsumer.as_asgi()),
	re_path(r'ws/patient/notifications/$', consumers.PatientNotificationConsumer.as_asgi()),
	re_path(r'ws/chat/(?P<session_id>\d+)/$', consumers.ChatConsumer.as_asgi()),
	re_path(r'ws/support/chat/$', consumers.SupportChatConsumer.as_asgi()),
]

