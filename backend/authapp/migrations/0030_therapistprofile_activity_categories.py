from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authapp', '0029_rename_authapp_psy_is_acti_order_idx_authapp_psy_is_acti_0e82ac_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='therapistprofile',
            name='activity_categories',
            field=models.ManyToManyField(
                blank=True,
                related_name='therapist_profiles',
                to='authapp.category',
                verbose_name='حوزه های فعالیت',
            ),
        ),
    ]
