from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage


class LiaraMediaStorage(S3Boto3Storage):
	"""Storage backend for Liara Object Storage (S3-compatible)"""
	location = ''
	# Avoid pre-upload HEAD checks; Liara may return 403 even when uploads are allowed.
	file_overwrite = True
	# Liara configuration - don't set ACL as it might not be supported
	default_acl = None
	endpoint_url = getattr(settings, 'AWS_S3_ENDPOINT_URL', 'https://storage.c2.liara.site')
	region_name = getattr(settings, 'AWS_S3_REGION_NAME', 'default')
	custom_domain = getattr(settings, 'AWS_S3_CUSTOM_DOMAIN', None)
	url_protocol = getattr(settings, 'AWS_S3_URL_PROTOCOL', 'http:')
	proxies = getattr(settings, 'AWS_S3_PROXIES', {})
	# Disable query string auth for public files
	querystring_auth = False
	
	def get_object_parameters(self, name):
		"""Override to not set ACL parameters - Liara might not support ACL"""
		params = super().get_object_parameters(name) if hasattr(super(), 'get_object_parameters') else {}
		# Remove ACL if present - Liara might not support it
		if 'ACL' in params:
			del params['ACL']
		return params
