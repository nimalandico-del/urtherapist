import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Environment configuration - set ENVIRONMENT=local for local development, ENVIRONMENT=production for production
ENVIRONMENT = os.getenv("ENVIRONMENT", "production").lower()

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-key-change-me")
# DEBUG defaults to True for local, False for production, but can be overridden
if ENVIRONMENT == "local":
	DEBUG = os.getenv("DEBUG", "1") == "1"
else:
	DEBUG = os.getenv("DEBUG", "0") == "1"
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "*").split(",")

INSTALLED_APPS = [
	"daphne",
	"django.contrib.admin",
	"django.contrib.auth",
	"django.contrib.contenttypes",
	"django.contrib.sessions",
	"django.contrib.messages",
	"django.contrib.staticfiles",
	"rest_framework",
	"corsheaders",
	"channels",
	"authapp",
	"storages",
	"object_storage",
]

MIDDLEWARE = [
	"django.middleware.security.SecurityMiddleware",
	"django.contrib.sessions.middleware.SessionMiddleware",
	"corsheaders.middleware.CorsMiddleware",
	"django.middleware.common.CommonMiddleware",
	"django.middleware.csrf.CsrfViewMiddleware",
	"django.contrib.auth.middleware.AuthenticationMiddleware",
	"django.contrib.messages.middleware.MessageMiddleware",
	"django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
	{
		"BACKEND": "django.template.backends.django.DjangoTemplates",
		"DIRS": [BASE_DIR / "templates"],
		"APP_DIRS": True,
		"OPTIONS": {
			"context_processors": [
				"django.template.context_processors.debug",
				"django.template.context_processors.request",
				"django.contrib.auth.context_processors.auth",
				"django.contrib.messages.context_processors.messages",
			],
		},
	}
]

# WSGI_APPLICATION = "core.wsgi.application"  # Removed for WebSocket support on Liara
ASGI_APPLICATION = "core.asgi.application"

# Channels configuration
# Use in-memory channel layer for local development, Redis for production
if ENVIRONMENT == "local":
	CHANNEL_LAYERS = {
		"default": {
			"BACKEND": "channels.layers.InMemoryChannelLayer"
		}
	}
else:
	# Redis configuration for Liara (private network)
	REDIS_HOST = os.getenv('REDIS_HOST', 'urtherapistredis')
	REDIS_PORT = os.getenv('REDIS_PORT', '6379')
	REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', 'U6FiwC2cWD0Se4MvzoXMgsn6')
	REDIS_DB = os.getenv('REDIS_DB', '0')
	REDIS_URI = os.getenv('REDIS_URI', None)

	# Build Redis URI if not provided
	# Format: redis://:password@host:port/db
	if not REDIS_URI:
		if REDIS_PASSWORD:
			REDIS_URI = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"
		else:
			REDIS_URI = f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

	# Use Redis Channel Layer for production (Liara)
	CHANNEL_LAYERS = {
		"default": {
			"BACKEND": "channels_redis.core.RedisChannelLayer",
			"CONFIG": {
				"hosts": [{
					"address": REDIS_URI,
				}]
			}
		}
	}

# Database configuration - switchable between local and production
if ENVIRONMENT == "local":
	# Local development database (SQLite for simplicity, or use local PostgreSQL)
	# To use local PostgreSQL, set DB_ENGINE=postgresql and provide DB credentials
	DB_ENGINE = os.getenv("DB_ENGINE", "sqlite3").lower()
	if DB_ENGINE == "postgresql":
		DATABASES = {
			"default": {
				"ENGINE": "django.db.backends.postgresql",
				"NAME": os.getenv("DB_NAME", "urtherapist_local"),
				"USER": os.getenv("DB_USER", "postgres"),
				"PASSWORD": os.getenv("DB_PASSWORD", "postgres"),
				"HOST": os.getenv("DB_HOST", "localhost"),
				"PORT": os.getenv("DB_PORT", "5432"),
			}
		}
	else:
		# Default to SQLite for local development
		DATABASES = {
			"default": {
				"ENGINE": "django.db.backends.sqlite3",
				"NAME": BASE_DIR / "db.sqlite3",
			}
		}
else:
	# Production database (Liara PostgreSQL)
	DATABASES = {
		"default": {
			"ENGINE": "django.db.backends.postgresql",
			"NAME": os.getenv("DB_NAME", "postgres"),
			"USER": os.getenv("DB_USER", "root"),
			"PASSWORD": os.getenv("DB_PASSWORD", "gIOqQJIoLY1eI6ZWkkmqi20g"),
			"HOST": os.getenv("DB_HOST", "urtherapistdb"),
			"PORT": os.getenv("DB_PORT", "5432"),
		}
	}

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AWS_ACCESS_KEY_ID = '100f8butcchdpteg'
AWS_SECRET_ACCESS_KEY = 'e5200a91-ff98-4950-9877-87bab0383c6e'
AWS_STORAGE_BUCKET_NAME = 'therapylane'
AWS_S3_ENDPOINT_URL = 'https://storage.c2.liara.site'
AWS_S3_REGION_NAME = 'us-east-1'
AWS_S3_ADDRESSING_STYLE = 'virtual'
AWS_S3_CUSTOM_DOMAIN = None
AWS_S3_URL_PROTOCOL = 'https:'
AWS_S3_PROXIES = {}
AWS_QUERYSTRING_AUTH = True
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

REST_FRAMEWORK = {
	"DEFAULT_AUTHENTICATION_CLASSES": (
		"rest_framework_simplejwt.authentication.JWTAuthentication",
	),
}

SIMPLE_JWT = {
	"ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
	"REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# CORS
CORS_ALLOW_ALL_ORIGINS = os.getenv("CORS_ALLOW_ALL", "1") == "1"
CORS_ALLOWED_ORIGINS = os.getenv("CORS_ALLOWED_ORIGINS", "").split(",") if os.getenv("CORS_ALLOWED_ORIGINS") else []

# OTP settings
OTP_EXPIRY_SECONDS = int(os.getenv("OTP_EXPIRY_SECONDS", "300"))
OTP_RESEND_WINDOW_SECONDS = int(os.getenv("OTP_RESEND_WINDOW_SECONDS", "45"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))

# Wallet settings
INITIAL_WALLET_CREDIT = int(os.getenv("INITIAL_WALLET_CREDIT", "2000000"))
INITIAL_WALLET_DESCRIPTION = os.getenv(
	"INITIAL_WALLET_DESCRIPTION",
	"اعتبار اولیه ثبت نام",
)

# Janus Gateway settings
JANUS_SERVER_URL = os.getenv("JANUS_SERVER_URL", "http://localhost:8088/janus")
JANUS_ADMIN_KEY = os.getenv("JANUS_ADMIN_KEY", "")  # Optional admin key for Janus
JANUS_ADMIN_SECRET = os.getenv("JANUS_ADMIN_SECRET", "")  # Optional admin secret

# STUN/TURN servers for WebRTC
STUN_SERVERS = [
	{"urls": "stun:stun.l.google.com:19302"},
	{"urls": "stun:stun1.l.google.com:19302"},
]

TURN_SERVERS = []  # Add TURN servers if needed, e.g.:
# TURN_SERVERS = [
#     {
#         "urls": "turn:your-turn-server.com:3478",
#         "username": "your-username",
#         "credential": "your-password"
#     }
# ]
