#!/usr/bin/env python
"""
Script to create test forms and questions for each psychological issue
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
os.environ['ENVIRONMENT'] = 'local'
os.environ['DB_ENGINE'] = 'sqlite3'

django.setup()

from authapp.models import Form, Question, PsychologicalIssue

# Form and question configurations per psychological issue
forms_config = {
    'Depression': {
        'title': 'Depression Assessment Form',
        'title_fa': 'فرم ارزیابی افسردگی',
        'description': 'This form helps assess depression symptoms and severity',
        'session_price': 300000,
        'questions': [
            {
                'text': 'How often do you feel sad or hopeless?',
                'text_fa': 'چند بار احساس ناامیدی یا غم و انگی می‌کنید؟',
                'type': 'multiple_choice_4',
                'options': 'Never,Rarely,Sometimes,Often',
                'options_fa': 'هرگز,کم,گاهی,اغلب'
            },
            {
                'text': 'Do you have difficulty sleeping or sleep too much?',
                'text_fa': 'آیا در خواب مشکل دارید یا خیلی زیاد می‌خوابید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'Describe your typical daily activities and energy levels',
                'text_fa': 'فعالیت‌های روزمره و سطح انرژی خود را توضیح دهید',
                'type': 'descriptive',
            },
            {
                'text': 'Do you have thoughts of self-harm?',
                'text_fa': 'آیا افکار خود‌ضربی دارید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'How would you rate your appetite changes?',
                'text_fa': 'تغییرات اشتهای خود را چطور ارزیابی می‌کنید؟',
                'type': 'multiple_choice_4',
                'options': 'No change,Decreased,Increased,Varies',
                'options_fa': 'بدون تغییر,کاهش,افزایش,متغیر'
            }
        ]
    },
    'Anxiety Disorder': {
        'title': 'Anxiety Disorder Assessment Form',
        'title_fa': 'فرم ارزیابی اختلال اضطراب',
        'description': 'Comprehensive anxiety assessment questionnaire',
        'session_price': 300000,
        'questions': [
            {
                'text': 'How often do you experience panic attacks?',
                'text_fa': 'چند بار حملات وحشت را تجربه می‌کنید؟',
                'type': 'multiple_choice_4',
                'options': 'Never,Monthly,Weekly,Daily',
                'options_fa': 'هرگز,ماهیانه,هفتگی,روزانه'
            },
            {
                'text': 'What are your main anxiety triggers?',
                'text_fa': 'اصلی ترین عوامل محرک اضطراب شما چیست؟',
                'type': 'descriptive',
            },
            {
                'text': 'Do you experience physical symptoms (heart racing, sweating)?',
                'text_fa': 'آیا نشانه‌های فیزیکی (تپش قلب، تعریق) دارید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'How much does anxiety affect your daily life (0-10)?',
                'text_fa': 'اضطراب چقدر روی زندگی روزمره شما تاثیر می‌گذارد؟ (۰-۱۰)',
                'type': 'number',
            },
            {
                'text': 'Do you avoid certain situations due to anxiety?',
                'text_fa': 'آیا از موقعیت‌های معینی به دلیل اضطراب احتراز می‌کنید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Stress Management': {
        'title': 'Stress Management Assessment',
        'title_fa': 'فرم ارزیابی مدیریت استرس',
        'description': 'Evaluate stress levels and coping mechanisms',
        'session_price': 250000,
        'questions': [
            {
                'text': 'Current stress level (1-10)?',
                'text_fa': 'سطح فعلی استرس (۱-۱۰)؟',
                'type': 'number',
            },
            {
                'text': 'What are the main sources of stress in your life?',
                'text_fa': 'اصلی ترین منابع استرس در زندگی شما چیست؟',
                'type': 'descriptive',
            },
            {
                'text': 'How do you typically cope with stress?',
                'text_fa': 'معمولاً چگونه با استرس مقابله می‌کنید؟',
                'type': 'multiple_choice_4',
                'options': 'Exercise,Meditation,Social support,Work harder',
                'options_fa': 'ورزش,مدیتیشن,حمایت اجتماعی,بیشتر کار کردن'
            },
            {
                'text': 'Do you have a regular exercise or relaxation routine?',
                'text_fa': 'آیا برنامه‌ای برای ورزش یا آرام‌سازی دارید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Sleep Disorders': {
        'title': 'Sleep Disorders Assessment',
        'title_fa': 'فرم ارزیابی اختلالات خواب',
        'description': 'Evaluate sleep quality and patterns',
        'session_price': 280000,
        'questions': [
            {
                'text': 'Average hours of sleep per night?',
                'text_fa': 'میانگین ساعات خواب در شب؟',
                'type': 'number',
            },
            {
                'text': 'How would you rate your sleep quality?',
                'text_fa': 'کیفیت خواب خود را چطور ارزیابی می‌کنید؟',
                'type': 'multiple_choice_4',
                'options': 'Excellent,Good,Fair,Poor',
                'options_fa': 'عالی,خوب,متوسط,ضعیف'
            },
            {
                'text': 'Do you have trouble falling asleep?',
                'text_fa': 'آیا در خوابیدن مشکل دارید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'Do you wake up during the night?',
                'text_fa': 'آیا در طول شب بیدار می‌شوید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'Describe any sleep disturbances or nightmares',
                'text_fa': 'هر گونه بی‌خوابی یا کابوس را توضیح دهید',
                'type': 'descriptive',
            }
        ]
    },
    'Low Self-Esteem': {
        'title': 'Self-Esteem Assessment Form',
        'title_fa': 'فرم ارزیابی عزت نفس',
        'description': 'Measure self-confidence and self-worth',
        'session_price': 250000,
        'questions': [
            {
                'text': 'I feel confident about my abilities',
                'text_fa': 'من در مورد توانایی‌های خود احساس اعتماد می‌کنم',
                'type': 'multiple_choice_4',
                'options': 'Strongly Disagree,Disagree,Agree,Strongly Agree',
                'options_fa': 'مخالفم,تا حدی مخالفم,موافقم,کاملاً موافقم'
            },
            {
                'text': 'I often criticize myself harshly',
                'text_fa': 'من اغلب از خود سخت انتقاد می‌کنم',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'What are your strengths and positive qualities?',
                'text_fa': 'قوت‌های و صفات مثبت خود چیست؟',
                'type': 'descriptive',
            },
            {
                'text': 'How do you respond to criticism?',
                'text_fa': 'چگونه به انتقاد پاسخ می‌دهید؟',
                'type': 'multiple_choice_4',
                'options': 'Very defensively,Somewhat defensively,Openly,Constructively',
                'options_fa': 'بسیار تدافعی,تا حدی تدافعی,باز,سازنده'
            }
        ]
    },
    'Relationship Problems': {
        'title': 'Relationship Problems Assessment',
        'title_fa': 'فرم ارزیابی مسائل رابطه ای',
        'description': 'Evaluate relationship satisfaction and issues',
        'session_price': 350000,
        'questions': [
            {
                'text': 'How satisfied are you with your relationship?',
                'text_fa': 'چقدر از رابطه خود راضی هستید؟',
                'type': 'number',
            },
            {
                'text': 'What are the main conflicts in your relationship?',
                'text_fa': 'اصلی ترین تعارض‌های رابطه شما چیست؟',
                'type': 'descriptive',
            },
            {
                'text': 'How often do you communicate with your partner?',
                'text_fa': 'چند بار با شریک خود ارتباط برقرار می‌کنید؟',
                'type': 'multiple_choice_4',
                'options': 'Rarely,Sometimes,Often,Daily',
                'options_fa': 'کم,گاهی,اغلب,روزانه'
            },
            {
                'text': 'Do you feel emotionally connected to your partner?',
                'text_fa': 'آیا احساس اتصال عاطفی به شریک خود دارید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Breakup & Loss': {
        'title': 'Breakup & Loss Grief Support',
        'title_fa': 'فرم حمایت غم و سوگ ناشی از پایان رابطه',
        'description': 'Support for coping with breakups and loss',
        'session_price': 320000,
        'questions': [
            {
                'text': 'When did your breakup occur?',
                'text_fa': 'پایان رابطه شما چه زمانی رخ داد؟',
                'type': 'short_text',
            },
            {
                'text': 'How are you coping with the separation?',
                'text_fa': 'چگونه با جدایی مقابله می‌کنید؟',
                'type': 'descriptive',
            },
            {
                'text': 'Are you having thoughts of contacting your ex?',
                'text_fa': 'آیا فکر تماس‌گیری به سابق شریک دارید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'Your current emotional state regarding the breakup',
                'text_fa': 'وضعیت عاطفی فعلی درباره پایان رابطه',
                'type': 'multiple_choice_4',
                'options': 'Devastated,Sad,Neutral,Moving on',
                'options_fa': 'ویرانگر,غمگین,خنثی,در حال پیشرفت'
            }
        ]
    },
    'Dating Anxiety': {
        'title': 'Dating Anxiety Assessment',
        'title_fa': 'فرم ارزیابی اضطراب رابطه عاطفی',
        'description': 'Assess anxiety related to dating and relationships',
        'session_price': 280000,
        'questions': [
            {
                'text': 'How anxious do you feel about dating? (1-10)',
                'text_fa': 'درباره رابطه عاطفی چقدر اضطراب دارید؟ (۱-۱۰)',
                'type': 'number',
            },
            {
                'text': 'What specific dating situations make you anxious?',
                'text_fa': 'کدام موقعیت‌های رابطه‌ای شما را ناراحت می‌کنند؟',
                'type': 'descriptive',
            },
            {
                'text': 'Do you avoid dating opportunities?',
                'text_fa': 'آیا از فرصت‌های رابطه‌ای احتراز می‌کنید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Loneliness': {
        'title': 'Loneliness Assessment Form',
        'title_fa': 'فرم ارزیابی تنهایی',
        'description': 'Assess feelings of isolation and social connection',
        'session_price': 250000,
        'questions': [
            {
                'text': 'How often do you feel lonely?',
                'text_fa': 'چند بار احساس تنهایی می‌کنید؟',
                'type': 'multiple_choice_4',
                'options': 'Never,Rarely,Often,Always',
                'options_fa': 'هرگز,کم,اغلب,همیشه'
            },
            {
                'text': 'How many close friends do you have?',
                'text_fa': 'چند دوست نزدیک دارید؟',
                'type': 'number',
            },
            {
                'text': 'Describe your social activities and connections',
                'text_fa': 'فعالیت‌های اجتماعی و ارتباطات خود را توضیح دهید',
                'type': 'descriptive',
            }
        ]
    },
    'Job Stress': {
        'title': 'Job Stress Assessment',
        'title_fa': 'فرم ارزیابی استرس شغلی',
        'description': 'Evaluate work-related stress and burnout',
        'session_price': 300000,
        'questions': [
            {
                'text': 'How satisfied are you with your job? (1-10)',
                'text_fa': 'چقدر از شغل خود راضی هستید؟ (۱-۱۰)',
                'type': 'number',
            },
            {
                'text': 'What aspects of your job cause the most stress?',
                'text_fa': 'کدام جنبه‌های شغل بیشترین استرس را ایجاد می‌کنند؟',
                'type': 'descriptive',
            },
            {
                'text': 'Do you work excessive hours?',
                'text_fa': 'آیا ساعات اضافی کار می‌کنید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'Signs of burnout (exhaustion, cynicism, reduced productivity)?',
                'text_fa': 'نشانه‌های فرسودگی شغلی (خستگی، بدبینی، کاهش بهره‌وری)؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Career Transition': {
        'title': 'Career Transition Counseling',
        'title_fa': 'فرم مشاوره تغییر شغل',
        'description': 'Support for career changes and transitions',
        'session_price': 350000,
        'questions': [
            {
                'text': 'Why are you considering a career change?',
                'text_fa': 'چرا تغییر شغل را در نظر می‌گیرید؟',
                'type': 'descriptive',
            },
            {
                'text': 'What is your desired career path?',
                'text_fa': 'مسیر شغلی مطلوب شما چیست؟',
                'type': 'descriptive',
            },
            {
                'text': 'Do you have concerns about making this change?',
                'text_fa': 'آیا درباره این تغییر نگرانی دارید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Workplace Conflict': {
        'title': 'Workplace Conflict Resolution',
        'title_fa': 'فرم حل تعارض در محل کار',
        'description': 'Address workplace relationships and conflicts',
        'session_price': 300000,
        'questions': [
            {
                'text': 'Describe the conflict with your coworker/supervisor',
                'text_fa': 'تعارض با همکار یا سرپرست خود را توضیح دهید',
                'type': 'descriptive',
            },
            {
                'text': 'How does this conflict affect your work?',
                'text_fa': 'این تعارض چگونه بر کار شما تاثیر می‌گذارد؟',
                'type': 'multiple_choice_4',
                'options': 'Minimally,Somewhat,Significantly,Severely',
                'options_fa': 'کمی,تا حدی,قابل‌توجه,شدیداً'
            },
            {
                'text': 'Have you attempted to resolve it?',
                'text_fa': 'آیا تلاش برای حل آن کرده‌اید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Performance Anxiety': {
        'title': 'Performance Anxiety Support',
        'title_fa': 'فرم حمایت اضطراب عملکرد',
        'description': 'Manage anxiety related to work performance',
        'session_price': 280000,
        'questions': [
            {
                'text': 'In which situations do you experience performance anxiety?',
                'text_fa': 'در کدام موقعیت‌ها اضطراب عملکرد احساس می‌کنید؟',
                'type': 'descriptive',
            },
            {
                'text': 'How severe is your performance anxiety? (1-10)',
                'text_fa': 'اضطراب عملکرد شما چقدر شدید است؟ (۱-۱۰)',
                'type': 'number',
            },
            {
                'text': 'Does it affect your job performance?',
                'text_fa': 'آیا بر عملکرد شغلی شما تاثیر می‌گذارد؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Life Transitions': {
        'title': 'Life Transitions Support',
        'title_fa': 'فرم حمایت از تغییرات زندگی',
        'description': 'Support for major life changes and adjustments',
        'session_price': 300000,
        'questions': [
            {
                'text': 'What life transition are you currently facing?',
                'text_fa': 'چه تغییری در زندگی در حال تجربه است؟',
                'type': 'descriptive',
            },
            {
                'text': 'How are you adjusting to this change?',
                'text_fa': 'چگونه با این تغییر سازگاری پیدا می‌کنید؟',
                'type': 'multiple_choice_4',
                'options': 'Struggling,With difficulty,Managing well,Thriving',
                'options_fa': 'مشکل,با تحمل,خوب,برتری'
            },
            {
                'text': 'Do you have support from family or friends?',
                'text_fa': 'آیا از حمایت خانواده یا دوستان برخوردار هستید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Identity & Purpose': {
        'title': 'Identity & Life Purpose Exploration',
        'title_fa': 'فرم بررسی هویت و هدف زندگی',
        'description': 'Explore personal identity and life purpose',
        'session_price': 320000,
        'questions': [
            {
                'text': 'Who do you believe you are, and what defines you?',
                'text_fa': 'شما تصور می‌کنید که چه کسی هستید و چه چیزی شما را تعریف می‌کند؟',
                'type': 'descriptive',
            },
            {
                'text': 'What is your life purpose or mission?',
                'text_fa': 'هدف یا ماموریت زندگی شما چیست؟',
                'type': 'descriptive',
            },
            {
                'text': 'Are you living in alignment with your values?',
                'text_fa': 'آیا مطابق با ارزش‌های خود زندگی می‌کنید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Grief & Bereavement': {
        'title': 'Grief & Bereavement Counseling',
        'title_fa': 'فرم مشاوره غم و سوگ',
        'description': 'Support for processing loss and grief',
        'session_price': 330000,
        'questions': [
            {
                'text': 'Who or what did you lose?',
                'text_fa': 'شما چه یا چه کسی را از دست دادید؟',
                'type': 'short_text',
            },
            {
                'text': 'When did this loss occur?',
                'text_fa': 'این سوگ چه زمانی رخ داد؟',
                'type': 'short_text',
            },
            {
                'text': 'How are you processing this grief?',
                'text_fa': 'چگونه با این سوگ روبه‌رو می‌شوید؟',
                'type': 'descriptive',
            },
            {
                'text': 'What support do you need most?',
                'text_fa': 'بیشتر به کدام حمایت نیاز دارید؟',
                'type': 'multiple_choice_4',
                'options': 'Emotional,Practical,Spiritual,Social',
                'options_fa': 'عاطفی,عملی,معنوی,اجتماعی'
            }
        ]
    },
    'Personal Growth': {
        'title': 'Personal Growth & Development',
        'title_fa': 'فرم رشد و توسعه شخصی',
        'description': 'Support for personal development and self-improvement',
        'session_price': 280000,
        'questions': [
            {
                'text': 'What areas of personal growth interest you most?',
                'text_fa': 'کدام حوزه‌های رشد شخصی شما را بیشتر جذب می‌کنند؟',
                'type': 'descriptive',
            },
            {
                'text': 'What are your main goals for self-improvement?',
                'text_fa': 'اهداف اصلی خودبهبود شما چیست؟',
                'type': 'descriptive',
            },
            {
                'text': 'What obstacles prevent your growth?',
                'text_fa': 'چه موانعی از رشد شما جلوگیری می‌کنند؟',
                'type': 'descriptive',
            }
        ]
    },
    'Parenting Challenges': {
        'title': 'Parenting Support & Guidance',
        'title_fa': 'فرم حمایت و راهنمایی فرزند‌پروری',
        'description': 'Support for parenting challenges and child behavior',
        'session_price': 300000,
        'questions': [
            {
                'text': 'What specific parenting challenges are you facing?',
                'text_fa': 'چه چالش‌های خاصی در فرزند‌پروری روبه‌رو هستید؟',
                'type': 'descriptive',
            },
            {
                'text': 'Age of your child/children?',
                'text_fa': 'سن فرزند یا فرزندان شما؟',
                'type': 'short_text',
            },
            {
                'text': 'How is your child\'s behavior affecting you?',
                'text_fa': 'رفتار فرزند چگونه بر شما تاثیر می‌گذارد؟',
                'type': 'descriptive',
            },
            {
                'text': 'Do you feel confident in your parenting skills?',
                'text_fa': 'آیا در مهارت‌های فرزند‌پروری خود اعتماد دارید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Family Conflict': {
        'title': 'Family Conflict Resolution',
        'title_fa': 'فرم حل تعارض خانوادگی',
        'description': 'Address family dynamics and conflicts',
        'session_price': 320000,
        'questions': [
            {
                'text': 'Who is involved in the family conflict?',
                'text_fa': 'در تعارض خانوادگی چه کسانی درگیر هستند؟',
                'type': 'short_text',
            },
            {
                'text': 'Describe the main family conflicts',
                'text_fa': 'اصلی‌ترین تعارض‌های خانوادگی را توضیح دهید',
                'type': 'descriptive',
            },
            {
                'text': 'How has this affected family relationships?',
                'text_fa': 'این چگونه روابط خانوادگی را تحت‌تاثیر قرار داده است؟',
                'type': 'descriptive',
            },
            {
                'text': 'Would you like family therapy?',
                'text_fa': 'آیا درمان خانوادگی را می‌خواهید؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            }
        ]
    },
    'Parent-Child Relationship': {
        'title': 'Parent-Child Relationship Support',
        'title_fa': 'فرم حمایت رابطه والدین و فرزندان',
        'description': 'Improve parent-child communication and bonding',
        'session_price': 300000,
        'questions': [
            {
                'text': 'What is the current state of your relationship with your parent(s)?',
                'text_fa': 'وضعیت فعلی رابطه شما با والدین چیست؟',
                'type': 'descriptive',
            },
            {
                'text': 'What communication issues exist?',
                'text_fa': 'چه مسائل ارتباطی وجود دارد؟',
                'type': 'descriptive',
            },
            {
                'text': 'Are there unresolved family issues from the past?',
                'text_fa': 'آیا مسائل حل‌نشده‌ای از گذشته وجود دارد؟',
                'type': 'yes_no',
                'options': 'Yes,No',
                'options_fa': 'بله,خیر'
            },
            {
                'text': 'What would improve your relationship?',
                'text_fa': 'چه چیزی رابطه شما را بهبود می‌بخشد؟',
                'type': 'descriptive',
            }
        ]
    }
}

# Create forms and questions
created_count = 0
question_count = 0

for issue_title, form_data in forms_config.items():
    try:
        # Find the psychological issue
        issue = PsychologicalIssue.objects.get(title=issue_title)
        
        # Check if form already exists
        form, created = Form.objects.get_or_create(
            psychological_issue=issue,
            defaults={
                'title': form_data['title'],
                'title_fa': form_data['title_fa'],
                'description': form_data['description'],
                'session_price': form_data['session_price'],
                'is_active': True,
            }
        )
        
        if created:
            created_count += 1
            print(f"✓ Created form: {form_data['title_fa']} for {issue_title}")
        else:
            print(f"• Form already exists for {issue_title}")
        
        # Create questions for this form
        for order, q_data in enumerate(form_data['questions'], 1):
            question, q_created = Question.objects.get_or_create(
                form=form,
                text=q_data['text'],
                defaults={
                    'text_fa': q_data['text_fa'],
                    'question_type': q_data['type'],
                    'options': q_data.get('options', ''),
                    'options_fa': q_data.get('options_fa', ''),
                    'is_required': True,
                    'is_active': True,
                    'order': order,
                }
            )
            if q_created:
                question_count += 1
                print(f"  ✓ Question {order}: {q_data['text_fa']}")
        
        print()
    
    except PsychologicalIssue.DoesNotExist:
        print(f"✗ PsychologicalIssue '{issue_title}' not found - skipping")

print("="*60)
print(f"\n✓ Forms and Questions creation complete!")
print(f"\nCreated Forms: {created_count}")
print(f"Created Questions: {question_count}")
print(f"Total Forms in DB: {Form.objects.count()}")
print(f"Total Questions in DB: {Question.objects.count()}")
