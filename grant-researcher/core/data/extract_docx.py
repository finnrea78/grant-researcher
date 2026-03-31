import zipfile
import re

path = 'researchers/anthony/raw/cv.docx'
with zipfile.ZipFile(path) as z:
    xml = z.read('word/document.xml').decode('utf-8')
    text = re.sub(r'<[^>]+>', ' ', xml)
    lines = [l.strip() for l in text.split('  ') if l.strip()]
    for line in lines:
        print(line)
