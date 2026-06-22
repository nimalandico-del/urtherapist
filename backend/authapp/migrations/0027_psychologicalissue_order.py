from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		('authapp', '0026_wallet_form_session_price_and_more'),
	]

	operations = [
		migrations.AddField(
			model_name='psychologicalissue',
			name='order',
			field=models.PositiveIntegerField(default=0, verbose_name='ترتیب نمایش'),
		),
		migrations.AlterModelOptions(
			name='psychologicalissue',
			options={'ordering': ['order', 'title']},
		),
		migrations.AddIndex(
			model_name='psychologicalissue',
			index=models.Index(fields=['is_active', 'order'], name='authapp_psy_is_acti_order_idx'),
		),
		migrations.AddIndex(
			model_name='psychologicalissue',
			index=models.Index(fields=['category', 'order'], name='authapp_psy_categor_order_idx'),
		),
	]
