from django.urls import path
from .views import (
	request_otp, verify_otp, dev_login, list_categories, list_psychological_issues, get_form, submit_form_response,
	get_user_profile, update_user_profile,
	list_session_requests, get_session_request, create_session_request_offer, list_session_request_offers,
	accept_session_request_offer, reject_session_request_offer,
	approve_session_request, deny_session_request,
	get_therapist_profile, create_or_update_therapist_profile,
	list_approved_therapists, get_therapist_profile_public,
	accept_therapist, reject_therapist,
	get_therapy_session, get_therapy_session_by_request, list_chat_messages,
	send_chat_message, mark_messages_as_read, end_therapy_session, list_my_therapy_sessions,
	get_jitsi_room, camera_test_page,
	create_post, list_posts, get_post_detail, add_or_update_reaction, remove_reaction, list_post_reactions,
	register_device_token, unregister_device_token, list_notifications, mark_notification_as_read,
	mark_all_notifications_as_read, send_notification,
	list_support_messages, send_support_message, mark_support_messages_as_read,
	list_support_chat_users, get_support_chat_for_user, send_support_staff_message,
	get_wallet,
)

urlpatterns = [
	path("request-otp/", request_otp),
	path("verify-otp/", verify_otp),
	path("dev-login/", dev_login),  # ⚠️ TODO: REMOVE BEFORE PRODUCTION - Development only - direct login without OTP
	path("categories/", list_categories),
	path("psychological-issues/", list_psychological_issues),
	path("psychological-issues/<int:issue_id>/form/", get_form),
	path("form-responses/submit/", submit_form_response),
	path("profile/", get_user_profile),
	path("profile/update/", update_user_profile),
	path("session-requests/", list_session_requests),
	path("session-requests/<int:request_id>/", get_session_request),
	path("session-requests/<int:request_id>/offers/", list_session_request_offers),
	path("session-requests/<int:request_id>/offers/create/", create_session_request_offer),
	path("session-requests/<int:request_id>/offers/<int:offer_id>/accept/", accept_session_request_offer),
	path("session-requests/<int:request_id>/offers/<int:offer_id>/reject/", reject_session_request_offer),
	path("session-requests/<int:request_id>/approve/", approve_session_request),
	path("session-requests/<int:request_id>/deny/", deny_session_request),
	# Therapist Profile endpoints
	path("therapist/profile/", get_therapist_profile),
	path("therapist/profile/update/", create_or_update_therapist_profile),
	path("therapists/", list_approved_therapists),  # Public list of approved therapists
	path("therapists/<int:therapist_id>/", get_therapist_profile_public),  # Public therapist profile
	# Patient therapist selection endpoints
	path("session-requests/<int:request_id>/accept-therapist/", accept_therapist),
	path("session-requests/<int:request_id>/reject-therapist/", reject_therapist),
	# Chat endpoints
	path("therapy-sessions/", list_my_therapy_sessions),
	path("therapy-sessions/<int:session_id>/", get_therapy_session),
	path("session-requests/<int:request_id>/therapy-session/", get_therapy_session_by_request),
	path("therapy-sessions/<int:session_id>/messages/", list_chat_messages),
	path("therapy-sessions/<int:session_id>/messages/send/", send_chat_message),
	path("therapy-sessions/<int:session_id>/messages/read/", mark_messages_as_read),
	path("therapy-sessions/<int:session_id>/end/", end_therapy_session),
	# Jitsi video call endpoint
	path("therapy-sessions/<int:session_id>/jitsi-room/", get_jitsi_room),
	# Camera test page endpoint
	path("camera-test/", camera_test_page),
	# Post endpoints
	path("posts/", list_posts),
	path("posts/create/", create_post),
	path("posts/<int:post_id>/", get_post_detail),
	path("posts/<int:post_id>/reactions/", list_post_reactions),
	path("posts/<int:post_id>/reactions/add/", add_or_update_reaction),
	path("posts/<int:post_id>/reactions/remove/", remove_reaction),
	# Device Token and Notification endpoints
	path("device-tokens/register/", register_device_token),
	path("device-tokens/<int:token_id>/unregister/", unregister_device_token),
	path("notifications/", list_notifications),
	path("notifications/<int:notification_id>/read/", mark_notification_as_read),
	path("notifications/read-all/", mark_all_notifications_as_read),
	path("notifications/send/", send_notification),  # Admin only
	# Support Chat endpoints
	path("support/messages/", list_support_messages),
	path("support/messages/send/", send_support_message),
	path("support/messages/read/", mark_support_messages_as_read),
	# Support Staff endpoints (for staff to respond)
	path("support/staff/users/", list_support_chat_users),
	path("support/staff/users/<int:user_id>/messages/", get_support_chat_for_user),
	path("support/staff/users/<int:user_id>/send/", send_support_staff_message),
	# Wallet
	path("wallet/", get_wallet),
]


