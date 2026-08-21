import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

count_json = content.count("express.json(")
count_urlenc = content.count("express.urlencoded(")
print(f"express.json( wystapien: {count_json}")
print(f"express.urlencoded( wystapien: {count_urlenc}")

for i, line in enumerate(content.split("\n"), 1):
    if "express.json(" in line or "express.urlencoded(" in line or "app.use(express" in line:
        print(f"{i}: {line}")
