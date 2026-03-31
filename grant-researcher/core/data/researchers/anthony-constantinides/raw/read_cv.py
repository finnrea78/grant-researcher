import docx
d = docx.Document('/home/finn/Developer/grant-scout-v2/grant-researcher/core/data/researchers/anthony-constantinides/raw/cv.docx')
for p in d.paragraphs:
    print(p.text)
