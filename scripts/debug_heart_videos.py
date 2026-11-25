import sys
import os
sys.path.insert(0, os.path.abspath('backend'))

from app.services.catalog.tmdb import _execute_tmdb_curl, check_youtube_video_details
from app.config import get_tmdb_auth_details

def main():
    auth = get_tmdb_auth_details()
    print("Auth mode:", auth.get('mode'), "source:", auth.get('source_var'), "token length:", len(auth.get('token', '')))
    
    # Try with longer timeout
    details = _execute_tmdb_curl('/movie/1263337', timeout=5.0)
    print("Details with 5s timeout:", details)

    videos = _execute_tmdb_curl('/movie/1263337/videos', timeout=5.0)
    print("Videos with 5s timeout:", videos)

if __name__ == '__main__':
    main()
