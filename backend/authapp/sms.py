import os
from typing import Optional


class SMSProvider:
	def send(self, to_phone: str, message: str) -> None:
		raise NotImplementedError


class ConsoleSMS(SMSProvider):
	def send(self, to_phone: str, message: str) -> None:
		print(f"[SMS -> {to_phone}] {message}")


class TwilioSMS(SMSProvider):
	def __init__(self):
		from twilio.rest import Client  # type: ignore
		self.client = Client(os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"))
		self.from_phone = os.getenv("TWILIO_FROM_NUMBER")

	def send(self, to_phone: str, message: str) -> None:
		self.client.messages.create(body=message, from_=self.from_phone, to=to_phone)


def get_sms_provider() -> SMSProvider:
	provider = os.getenv("SMS_PROVIDER", "console").lower()
	if provider == "twilio":
		return TwilioSMS()
	return ConsoleSMS()



