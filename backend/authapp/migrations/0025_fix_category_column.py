# Generated manually to fix category column issue

from django.db import migrations, connection


def fix_category_column(apps, schema_editor):
    """Add category_id column if it doesn't exist"""
    with connection.cursor() as cursor:
        # Check if category_id column exists
        cursor.execute("PRAGMA table_info(authapp_psychologicalissue)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'category_id' not in columns:
            # Add the category_id column
            cursor.execute("""
                ALTER TABLE authapp_psychologicalissue 
                ADD COLUMN category_id INTEGER REFERENCES authapp_category(id)
            """)


def reverse_fix_category_column(apps, schema_editor):
    """Remove category_id column"""
    with connection.cursor() as cursor:
        cursor.execute("PRAGMA table_info(authapp_psychologicalissue)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'category_id' in columns:
            # SQLite doesn't support DROP COLUMN directly, so we skip reverse
            pass


class Migration(migrations.Migration):

    dependencies = [
        ('authapp', '0024_category_alter_psychologicalissue_category'),
    ]

    operations = [
        migrations.RunPython(fix_category_column, reverse_fix_category_column),
    ]

