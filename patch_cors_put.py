import io

PATH = "server.js"

with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """app.use(cors({
  origin: ['https://aisomeboost.vercel.app', 'https://aisomeboost.netlify.app', 'http://localhost:3000', 'http://localhost:5500'],
  methods: ['GET', 'POST'],
  credentials: false
}));"""

assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = """app.use(cors({
  origin: ['https://aisomeboost.vercel.app', 'https://aisomeboost.netlify.app', 'http://localhost:3000', 'http://localhost:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: false
}));"""

content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: dodano PUT/DELETE do dozwolonych metod CORS")
