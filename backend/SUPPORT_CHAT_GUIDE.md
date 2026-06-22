# Support Chat - Staff Guide

## Where Support Staff Can Answer Patients

There are **two ways** for support staff to respond to patient messages:

### 1. Django Admin Interface (Web-based)

**URL:** `http://your-domain.com/admin/`

**Steps:**
1. Log in to Django admin with a staff/superuser account
2. Navigate to **"Support Chats"** section
3. You can:
   - View all support messages
   - Filter by user, read status, message type
   - Search for specific users or messages
   - Click on a message to view details and edit

**To respond via Admin:**
- Click on a support chat message
- You can see the user who sent it
- Create a new message by clicking "Add Support Chat" and set:
  - `user`: Select the patient
  - `sender`: Your staff account
  - `is_support_staff`: ✅ Check this box
  - `content`: Your response message

### 2. API Endpoints (For Custom Frontend/Apps)

If you want to build a custom interface, use these API endpoints:

#### List All Users with Support Chats
```
GET /api/auth/support/staff/users/
Headers: Authorization: Bearer <staff_token>
```
Returns list of users who have support chats with unread count.

#### Get Messages for a Specific User
```
GET /api/auth/support/staff/users/<user_id>/messages/
Headers: Authorization: Bearer <staff_token>
```
Returns all messages in the conversation with that user.

#### Send Response as Support Staff
```
POST /api/auth/support/staff/users/<user_id>/send/
Headers: Authorization: Bearer <staff_token>
Body: {
  "content": "Your response message",
  "message_type": "TEXT"  // or "VOICE" or "IMAGE"
}
```
Sends a message to the user. The message will be marked as `is_support_staff=True`.

### Requirements

- User must have `is_staff=True` or `is_superuser=True` in Django
- All endpoints require authentication with a valid JWT token
- Messages sent by staff are automatically marked as `is_support_staff=True`
- Messages are sent via WebSocket in real-time to the patient's app

### Example: Making a User Support Staff

In Django admin or Django shell:
```python
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.get(username='support_staff_username')
user.is_staff = True
user.save()
```

### Real-time Updates

When support staff sends a message:
1. Message is saved to database
2. WebSocket notification is sent to the patient's app
3. Patient sees the message immediately in their SupportChatScreen

## Testing

1. Create a staff user in Django admin
2. Get JWT token by logging in via `/api/auth/verify-otp/`
3. Use the token to call support staff endpoints
4. Messages will appear in patient's app in real-time

