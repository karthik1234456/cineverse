import urllib.request
import json
import sys
sys.path.insert(0, 'backend')
from app.services.auth_service import create_access_token

token = create_access_token({'sub': '18'})
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/bookings/user/my-bookings',
    headers={'Authorization': f'Bearer {token}'}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    b0 = data[0]
    print("Keys in booking 0:", list(b0.keys()))
    print("start_time:", b0.get('start_time'))
    print("status:", b0.get('status'))
    print("can_cancel:", b0.get('can_cancel'))
    print("movie_title:", b0.get('movie_title'))
