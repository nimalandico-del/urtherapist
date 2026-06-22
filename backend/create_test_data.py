#!/usr/bin/env python
"""
Script to create test data for urtherapist project
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
os.environ['ENVIRONMENT'] = 'local'
os.environ['DB_ENGINE'] = 'sqlite3'

django.setup()

from authapp.models import Category, PsychologicalIssue

# Clear existing data (optional)
# Category.objects.all().delete()
# PsychologicalIssue.objects.all().delete()

# Create categories
categories_data = [
    {
        'name': 'Mental Health',
        'name_fa': 'سلامت روانی',
        'description': 'Issues related to mental health and psychological well-being',
        'description_fa': 'مسائل مرتبط با سلامت روانی و رفاه روان',
        'order': 1
    },
    {
        'name': 'Relationship Issues',
        'name_fa': 'مسائل رابطه ای',
        'description': 'Concerns about relationships, dating, and communication',
        'description_fa': 'نگرانی های مرتبط با روابط، آشنایی و ارتباطات',
        'order': 2
    },
    {
        'name': 'Work & Career',
        'name_fa': 'کار و شغل',
        'description': 'Issues related to work stress, career development, and workplace conflicts',
        'description_fa': 'مسائل مرتبط با استرس شغلی، توسعه شغلی و تعارضات محل کار',
        'order': 3
    },
    {
        'name': 'Life Challenges',
        'name_fa': 'چالش های زندگی',
        'description': 'General life challenges, transitions, and personal growth',
        'description_fa': 'چالش های عمومی زندگی، تغییرات و رشد شخصی',
        'order': 4
    },
    {
        'name': 'Family & Parenting',
        'name_fa': 'خانواده و فرزند پروری',
        'description': 'Issues related to family dynamics and parenting challenges',
        'description_fa': 'مسائل مرتبط با دینامیک خانوادگی و چالش های فرزند پروری',
        'order': 5
    }
]

# Create psychological issues
issues_data = [
    # Mental Health Issues
    {
        'title': 'Depression',
        'title_fa': 'افسردگی',
        'description': 'Persistent feelings of sadness, hopelessness, and loss of interest',
        'description_fa': 'احساسات مداوم ناامیدی و بی انگیزگی',
        'category_name': 'Mental Health'
    },
    {
        'title': 'Anxiety Disorder',
        'title_fa': 'اختلال اضطراب',
        'description': 'Excessive worry, nervousness, and panic attacks',
        'description_fa': 'نگرانی بیش از حد، عصبانیت و حملات وحشت',
        'category_name': 'Mental Health'
    },
    {
        'title': 'Stress Management',
        'title_fa': 'مدیریت استرس',
        'description': 'Difficulty coping with daily stressors and life pressures',
        'description_fa': 'دشواری در مقابله با استرس های روزمره و فشارهای زندگی',
        'category_name': 'Mental Health'
    },
    {
        'title': 'Sleep Disorders',
        'title_fa': 'اختلالات خواب',
        'description': 'Insomnia, sleep apnea, and other sleep-related issues',
        'description_fa': 'بی خوابی و سایر مسائل مرتبط با خواب',
        'category_name': 'Mental Health'
    },
    {
        'title': 'Low Self-Esteem',
        'title_fa': 'عزت نفس پایین',
        'description': 'Negative self-image and lack of confidence',
        'description_fa': 'تصویر منفی از خود و کمبود اعتماد به نفس',
        'category_name': 'Mental Health'
    },
    
    # Relationship Issues
    {
        'title': 'Relationship Problems',
        'title_fa': 'مسائل رابطه ای',
        'description': 'Conflict, communication issues, and emotional distance in relationships',
        'description_fa': 'تعارض، مسائل ارتباطی و فاصله عاطفی در روابط',
        'category_name': 'Relationship Issues'
    },
    {
        'title': 'Breakup & Loss',
        'title_fa': 'پایان رابطه و تنهایی',
        'description': 'Coping with breakups, divorce, and feelings of loss',
        'description_fa': 'مقابله با پایان رابطه، طلاق و احساسات تنهایی',
        'category_name': 'Relationship Issues'
    },
    {
        'title': 'Dating Anxiety',
        'title_fa': 'اضطراب رابطه عاطفی',
        'description': 'Fear and anxiety about dating and meeting new people',
        'description_fa': 'ترس و اضطراب در رابطه با آشنایی و ملاقات افراد جدید',
        'category_name': 'Relationship Issues'
    },
    {
        'title': 'Loneliness',
        'title_fa': 'تنهایی',
        'description': 'Feelings of isolation and disconnection from others',
        'description_fa': 'احساسات انزوا و قطع ارتباط از دیگران',
        'category_name': 'Relationship Issues'
    },
    
    # Work & Career Issues
    {
        'title': 'Job Stress',
        'title_fa': 'استرس شغلی',
        'description': 'Work-related stress, burnout, and exhaustion',
        'description_fa': 'استرس شغلی، فرسودگی شغلی و خستگی',
        'category_name': 'Work & Career'
    },
    {
        'title': 'Career Transition',
        'title_fa': 'تغییر شغل',
        'description': 'Uncertainty about career choices and job transitions',
        'description_fa': 'عدم اطمینان درخصوص انتخاب های شغلی و تغییر شغل',
        'category_name': 'Work & Career'
    },
    {
        'title': 'Workplace Conflict',
        'title_fa': 'تعارض در محل کار',
        'description': 'Difficulty with coworkers and workplace relationships',
        'description_fa': 'دشواری در روابط با همکاران و محیط کار',
        'category_name': 'Work & Career'
    },
    {
        'title': 'Performance Anxiety',
        'title_fa': 'اضطراب عملکرد',
        'description': 'Anxiety about job performance and professional competence',
        'description_fa': 'اضطراب درخصوص عملکرد شغلی و صلاحیت حرفه ای',
        'category_name': 'Work & Career'
    },
    
    # Life Challenges
    {
        'title': 'Life Transitions',
        'title_fa': 'تغییرات زندگی',
        'description': 'Adjusting to major life changes (moving, school, life events)',
        'description_fa': 'سازگاری با تغییرات عمده زندگی',
        'category_name': 'Life Challenges'
    },
    {
        'title': 'Identity & Purpose',
        'title_fa': 'هویت و هدف زندگی',
        'description': 'Confusion about personal identity and life purpose',
        'description_fa': 'سردرگمی درخصوص هویت شخصی و هدف زندگی',
        'category_name': 'Life Challenges'
    },
    {
        'title': 'Grief & Bereavement',
        'title_fa': 'غم و سوگ',
        'description': 'Processing loss and dealing with grief',
        'description_fa': 'پردازش سوگ و مقابله با احساسات غم انگیز',
        'category_name': 'Life Challenges'
    },
    {
        'title': 'Personal Growth',
        'title_fa': 'رشد شخصی',
        'description': 'Seeking guidance for self-improvement and personal development',
        'description_fa': 'جستجو برای خودبهبود و توسعه شخصی',
        'category_name': 'Life Challenges'
    },
    
    # Family & Parenting
    {
        'title': 'Parenting Challenges',
        'title_fa': 'چالش های فرزند پروری',
        'description': 'Guidance on parenting strategies and child behavior',
        'description_fa': 'راهنمایی در مورد استراتژی های فرزند پروری',
        'category_name': 'Family & Parenting'
    },
    {
        'title': 'Family Conflict',
        'title_fa': 'تعارض خانوادگی',
        'description': 'Issues with family members and internal family dynamics',
        'description_fa': 'مسائل با اعضای خانواده و دینامیک خانوادگی',
        'category_name': 'Family & Parenting'
    },
    {
        'title': 'Parent-Child Relationship',
        'title_fa': 'رابطه والدین و فرزندان',
        'description': 'Improving communication and understanding with parents',
        'description_fa': 'بهبود ارتباط و درک متقابل با والدین',
        'category_name': 'Family & Parenting'
    },
]

# Create or get categories
created_categories = {}
for cat_data in categories_data:
    cat, created = Category.objects.get_or_create(
        name=cat_data['name'],
        defaults={
            'name_fa': cat_data['name_fa'],
            'description': cat_data['description'],
            'order': cat_data['order'],
            'is_active': True
        }
    )
    created_categories[cat_data['name']] = cat
    if created:
        print(f"✓ Created category: {cat_data['name']} / {cat_data['name_fa']}")
    else:
        print(f"• Category already exists: {cat_data['name']}")

print("\n" + "="*60 + "\n")

# Create psychological issues
for issue_data in issues_data:
    category = created_categories[issue_data['category_name']]
    issue, created = PsychologicalIssue.objects.get_or_create(
        title=issue_data['title'],
        category=category,
        defaults={
            'title_fa': issue_data['title_fa'],
            'description': issue_data['description'],
            'is_active': True
        }
    )
    if created:
        print(f"✓ Created issue: {issue_data['title']} / {issue_data['title_fa']}")
    else:
        print(f"• Issue already exists: {issue_data['title']}")

print("\n" + "="*60)
print("\n✓ Test data creation complete!")
print(f"\nTotal Categories: {Category.objects.count()}")
print(f"Total Psychological Issues: {PsychologicalIssue.objects.count()}")
