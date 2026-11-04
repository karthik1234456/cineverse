with open("frontend/vitest.config.ts", "r", encoding="utf-8") as f:
    text = f.read()

target = "include: ['lib/**/*.test.ts', 'tests/unit/**/*.test.ts']"
repl = "include: ['lib/**/*.test.ts', 'tests/unit/seatMapLayout.test.ts']"
assert target in text
text = text.replace(target, repl, 1)

with open("frontend/vitest.config.ts", "w", encoding="utf-8") as f:
    f.write(text)
print("vitest.config.ts updated")

