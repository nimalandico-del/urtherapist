from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from authapp.admin import send_notification_view, support_chat_view

urlpatterns = [
	path("admin/send-notification/", admin.site.admin_view(send_notification_view), name='admin_send_notification'),
	path("admin/support-chat/", admin.site.admin_view(support_chat_view), name='admin_support_chat'),
	path("admin/", admin.site.urls),
	path("api/auth/", include("authapp.urls")),
	path("object-storage/", include("object_storage.urls")),
]

if settings.DEBUG:
	urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)



