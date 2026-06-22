# Generated manually for group therapy support

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('authapp', '0020_post_postreaction_and_more'),
    ]

    operations = [
        # Add group therapy fields to Form
        migrations.AddField(
            model_name='form',
            name='group_therapy_enabled',
            field=models.BooleanField(default=False, verbose_name='درمان گروهی فعال'),
        ),
        migrations.AddField(
            model_name='form',
            name='group_therapy_max_patients',
            field=models.PositiveIntegerField(default=3, help_text='حداکثر تعداد بیمارانی که می\u200cتوانند در یک گروه درمانی شرکت کنند', verbose_name='حداکثر تعداد بیماران در درمان گروهی'),
        ),
        # Add is_group_therapy to FormResponse
        migrations.AddField(
            model_name='formresponse',
            name='is_group_therapy',
            field=models.BooleanField(default=False, verbose_name='درمان گروهی'),
        ),
        # Modify SessionRequest to support multiple patients
        migrations.AlterField(
            model_name='sessionrequest',
            name='form_response',
            field=models.ForeignKey(blank=True, help_text='پاسخ فرم نماینده برای درخواست (برای درمان گروهی، می\u200cتواند null باشد)', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='session_requests', to='authapp.formresponse', verbose_name='پاسخ فرم اصلی'),
        ),
        migrations.AlterField(
            model_name='sessionrequest',
            name='patient',
            field=models.ForeignKey(blank=True, help_text='بیمار اصلی (برای سازگاری با نسخه قبلی). برای درمان گروهی از patients استفاده کنید.', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='session_requests', to=settings.AUTH_USER_MODEL, verbose_name='بیمار اصلی'),
        ),
        migrations.AddField(
            model_name='sessionrequest',
            name='is_group_therapy',
            field=models.BooleanField(default=False, verbose_name='درمان گروهی'),
        ),
        migrations.AddField(
            model_name='sessionrequest',
            name='patients',
            field=models.ManyToManyField(help_text='لیست بیماران در این درخواست (برای درمان گروهی)', related_name='group_session_requests', to=settings.AUTH_USER_MODEL, verbose_name='بیماران'),
        ),
        # Modify TherapySession to support multiple patients
        migrations.AlterField(
            model_name='therapysession',
            name='patient',
            field=models.ForeignKey(blank=True, help_text='بیمار اصلی (برای سازگاری با نسخه قبلی). برای درمان گروهی از patients استفاده کنید.', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='therapy_sessions_as_patient', to=settings.AUTH_USER_MODEL, verbose_name='بیمار اصلی'),
        ),
        migrations.AddField(
            model_name='therapysession',
            name='is_group_therapy',
            field=models.BooleanField(default=False, verbose_name='درمان گروهی'),
        ),
        migrations.AddField(
            model_name='therapysession',
            name='patients',
            field=models.ManyToManyField(help_text='لیست بیماران در این جلسه درمانی (برای درمان گروهی)', related_name='group_therapy_sessions', to=settings.AUTH_USER_MODEL, verbose_name='بیماران'),
        ),
    ]



