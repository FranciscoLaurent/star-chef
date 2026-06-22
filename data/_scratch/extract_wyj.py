import re
html = open('D:/Study/AI_Space/play-CC/star_chef/data/_scratch/wyj.html', 'r', encoding='utf-8').read()
text = re.sub(r'<[^>]+>', ' ', html)
text = re.sub(r'\s+', ' ', text)
for kw in ['徒弟', '弟子', '师承', '师从', '收徒', '拜师', '师傅', '师傅们']:
    for m in re.finditer(kw, text):
        s = max(0, m.start() - 80)
        e = min(len(text), m.end() + 300)
        print('---', kw, '---')
        print(text[s:e])
        print()
