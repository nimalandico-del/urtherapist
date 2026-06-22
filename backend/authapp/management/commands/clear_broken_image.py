from django.core.management.base import BaseCommand
from authapp.models import PsychologicalIssue


class Command(BaseCommand):
    help = 'Clear broken image from PsychologicalIssue with title "22"'

    def handle(self, *args, **options):
        # Find the issue with title '22'
        issue = PsychologicalIssue.objects.filter(title='22').first()

        if issue:
            self.stdout.write(f"Found issue: {issue.title} (ID: {issue.id})")
            self.stdout.write(f"Current image: {issue.image}")
            
            # Clear the image field
            issue.image = None
            issue.save()
            
            self.stdout.write(self.style.SUCCESS('✅ Image field cleared successfully!'))
        else:
            self.stdout.write(self.style.WARNING('❌ Issue with title "22" not found'))
            
            # Try to find any issue with the broken image path
            all_issues = PsychologicalIssue.objects.filter(is_active=True)
            self.stdout.write(f"\nChecking {all_issues.count()} active issues...")
            
            found = False
            for iss in all_issues:
                if iss.image and 'photo_2024-10-30_20-27-51' in str(iss.image):
                    self.stdout.write(f"Found issue with broken image: {iss.title} (ID: {iss.id})")
                    iss.image = None
                    iss.save()
                    self.stdout.write(self.style.SUCCESS(f'✅ Cleared image for issue: {iss.title}'))
                    found = True
            
            if not found:
                self.stdout.write(self.style.WARNING('No issues with broken image found'))

