"""
Custom admin site configuration
"""
from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

class CustomAdminSite(admin.AdminSite):
	site_header = "UrTherapist Admin"
	site_title = "UrTherapist Admin"
	index_title = "Welcome to UrTherapist Administration"
	
	def get_urls(self):
		urls = super().get_urls()
		from django.urls import path
		from .admin import send_notification_view
		custom_urls = [
			path('send-notification/', self.admin_view(send_notification_view), name='send_notification'),
		]
		return custom_urls + urls
	
	def index(self, request, extra_context=None):
		extra_context = extra_context or {}
		extra_context['send_notification_url'] = reverse('admin:send_notification')
		return super().index(request, extra_context)

