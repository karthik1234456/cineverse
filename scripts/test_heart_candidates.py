import sys
import os
sys.path.insert(0, os.path.abspath('backend'))

from app.services.catalog.tmdb import check_youtube_video_details, _execute_tmdb_curl

def main():
    videos = _execute_tmdb_curl('/movie/1263337/videos', timeout=5.0)
    if not videos or 'results' not in videos:
        print("Failed to get videos")
        return

    results = videos['results']
    print(f"Total videos for Heart of the Beast: {len(results)}")
    for v in results:
        key = v.get('key')
        v_type = v.get('type')
        name = v.get('name')
        off = v.get('official')
        is_emb, is_sh, w, h, title = check_youtube_video_details(key)
        if is_emb and not is_sh:
            print(f"EMBEDDABLE: key={key}, type={v_type}, off={off}, name='{name}', title='{title}', size={w}x{h}")
        else:
            print(f"NOT EMBEDDABLE: key={key}, type={v_type}, is_emb={is_emb}, is_sh={is_sh}")

if __name__ == '__main__':
    main()
