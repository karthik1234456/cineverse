import urllib.request
import json
import sys
sys.path.insert(0, 'backend')
from app.services.auth_service import create_access_token

token = create_access_token({'sub': '18'})
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/bookings/88001/invoices',
    headers={'Authorization': f'Bearer {token}'}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print(f"Fetched {len(data)} invoices via API!")
    for d in data:
        print(f"Inv: {d['invoice_number']} | Type: {d['invoice_type']} | Total: ₹{d['final_total_rupees']} | PDF: {d['download_url']}")
