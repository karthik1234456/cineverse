path = 'backend/tests/test_phase12_operations.py'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    'os.path.join(os.path.dirname(__file__), "../../../frontend/public/models/cineverse_auditorium_v2.glb")',
    'os.path.join(os.path.dirname(__file__), "../../frontend/public/models/cineverse_auditorium_v2.glb")'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print("Fixed relative path in test_phase12_operations.py")

