path = 'backend/app/database.py'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

old_cfg = '''# Engine configuration
connect_args = {}
if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args if connect_args else {}
)'''

new_cfg = '''# Engine configuration
connect_args = {}
if "sqlite" in settings.DATABASE_URL:
    connect_args["check_same_thread"] = False
    connect_args["timeout"] = 60.0  # 60s busy timeout for high-concurrency sqlite

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args if connect_args else {}
)'''

if old_cfg in c:
    c = c.replace(old_cfg, new_cfg)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(c)
    print("Updated database.py with 60s timeout for sqlite")
else:
    print("old_cfg not found")

