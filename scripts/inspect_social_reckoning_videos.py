import json
import urllib.request

keys = ['R8ANzYpaZaY', 'MfHEZw7Xw_c', 'gM4LkaXwGuY', '5QwNaYwslzE']
for k in keys:
    url = f'https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={k}&format=json'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as res:
            data = json.loads(res.read().decode())
            w = data.get('width')
            h = data.get('height')
            title = data.get('title')
            print(f"Key: {k} -> HTTP 200 | {w}x{h} | Aspect: {w/h:.2f} | Title: {title}")
    except Exception as e:
        print(f"Key: {k} -> FAILED: {e}")
