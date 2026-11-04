with open("backend/app/models/operations.py", "r", encoding="utf-8") as f:
    text = f.read()

target = '    OFFLINE_RESOLVED = "OFFLINE_RESOLVED"'
repl = '    OFFLINE_RESOLVED = "OFFLINE_RESOLVED"\n    OFFLINE_DUPLICATE_CONFLICT = "OFFLINE_DUPLICATE_CONFLICT"'

assert target in text, "target not found"
text = text.replace(target, repl, 1)

with open("backend/app/models/operations.py", "w", encoding="utf-8") as f:
    f.write(text)
print("Updated successfully")

