import sys
sys.path.insert(0, 'backend')
import sqlite3
from app.core.security import verify_password, create_access_token

conn = sqlite3.connect('backend/cineverse.db')
c = conn.cursor()
c.execute("SELECT id, email, password_hash, role FROM users WHERE role = 'ADMIN'")
for uid, email, h, role in c.fetchall():
    print(f"Admin: {uid}, {email}")
    for pw in ['Admin@123', 'admin123', 'Admin123!', 'Admin@1234', 'Admin@cineverse1']:
        if verify_password(pw, h):
            print(f"Match: {email} -> {pw}")
            break
    token = create_access_token(data={"sub": str(uid), "email": email, "role": role})
    print(f"Generated admin token for {email}: {token[:20]}...")

c.execute("SELECT id, email, password_hash, role FROM users WHERE id = 4")
for uid, email, h, role in c.fetchall():
    print(f"Patron: {uid}, {email}")
    token = create_access_token(data={"sub": str(uid), "email": email, "role": role})
    print(f"Generated patron token: {token[:20]}...")
