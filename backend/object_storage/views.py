from django.shortcuts import render
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile


IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg')
VIDEO_EXTENSIONS = ('.mp4', '.webm', '.ogg', '.mov')
AUDIO_EXTENSIONS = ('.mp3', '.wav', '.ogg', '.m4a')
PUBLIC_FILE_DOMAIN = 'https://therapylane.ir'


def get_liara_file_url(file_name):
    return f'{PUBLIC_FILE_DOMAIN}/{file_name}'


def upload_file(request):
    if request.method == 'POST' and request.FILES.get('file'):
        file = request.FILES['file']
        path = default_storage.save(file.name, ContentFile(file.read()))
        return render(request, 'object_storage/upload.html', {'path': path, 'files': get_uploaded_files()})
    return render(request, 'object_storage/upload.html', {'files': get_uploaded_files()})


def get_uploaded_files():
    directories, files = default_storage.listdir('')
    uploaded_files = []
    for file in files:
        lower_name = file.lower()
        uploaded_files.append({
            'name': file,
            'url': get_liara_file_url(file),
            'is_image': lower_name.endswith(IMAGE_EXTENSIONS),
            'is_video': lower_name.endswith(VIDEO_EXTENSIONS),
            'is_audio': lower_name.endswith(AUDIO_EXTENSIONS),
        })
    return uploaded_files
