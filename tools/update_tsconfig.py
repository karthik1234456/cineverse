with open("frontend/tsconfig.json", "r", encoding="utf-8") as f:
    text = f.read()

target = '"exclude": ["node_modules"]'
repl = '"exclude": ["node_modules", "tests/unit/ref_*.test.ts"]'
assert target in text
text = text.replace(target, repl, 1)

with open("frontend/tsconfig.json", "w", encoding="utf-8") as f:
    f.write(text)
print("tsconfig.json updated")

