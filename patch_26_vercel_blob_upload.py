import io, sys

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

changes_applied = []
changes_failed = []

def replace_once(label, old, new, content):
    count = content.count(old)
    if count != 1:
        changes_failed.append((label, count))
        print(f"[FAIL] {label}: znaleziono {count}x (oczekiwano 1x) — SKIP")
        return content
    content = content.replace(old, new, 1)
    changes_applied.append(label)
    print(f"[OK]   {label}")
    return content

# ============================================================
# 1) Import @vercel/blob
# ============================================================
old_1 = "import bcrypt from 'bcryptjs';"
new_1 = "import bcrypt from 'bcryptjs';\nimport { put } from '@vercel/blob';"
content = replace_once("import { put } from '@vercel/blob'", old_1, new_1, content)

# ============================================================
# 2) Helper function uploadImageToBlob
# ============================================================
old_2 = "const { PDFParse } = require('pdf-parse');"
new_2 = """const { PDFParse } = require('pdf-parse');

async function uploadImageToBlob(b64, ext) {
  const buf = Buffer.from(b64, 'base64');
  const filename = 'designs/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const { url } = await put(filename, buf, {
    access: 'public',
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
    addRandomSuffix: false
  });
  return url;
}"""
content = replace_once("helper uploadImageToBlob()", old_2, new_2, content)

# ============================================================
# 3) Endpoint A: prosty generate-image (gpt-image-1 direct)
# ============================================================
old_3 = """    if (data.data?.[0]?.b64_json) {
      res.json({ url: 'data:image/png;base64,' + data.data[0].b64_json });
    } else {"""
new_3 = """    if (data.data?.[0]?.b64_json) {
      const url = await uploadImageToBlob(data.data[0].b64_json, 'png');
      res.json({ url });
    } else {"""
content = replace_once("endpoint A: upload do Blob (url)", old_3, new_3, content)

# ============================================================
# 4) Endpoint B: glowny generator designu (image_generation_call)
# ============================================================
old_4 = """    res.json({
      image: 'data:image/png;base64,' + b64,
      prompt,
      referencesUsed: usingCustomRefs ? 'project-reference-designs' : references,
      pair: { bg: pair.bg, bgName: pair.bgName, text: pair.text, accent: pair.accent },
      format: format || 'post-4-5',"""
new_4 = """    const uploadedImageUrl = await uploadImageToBlob(b64, 'png');
    res.json({
      image: uploadedImageUrl,
      prompt,
      referencesUsed: usingCustomRefs ? 'project-reference-designs' : references,
      pair: { bg: pair.bg, bgName: pair.bgName, text: pair.text, accent: pair.accent },
      format: format || 'post-4-5',"""
content = replace_once("endpoint B: upload do Blob (image, design generator)", old_4, new_4, content)

# ============================================================
# 5) Endpoint C: karuzela (slajdy, image_generation_call w Promise.all)
# ============================================================
old_5 = """      const b64 = imgCall.result;
      const imageDataUrl = 'data:image/png;base64,' + b64;

      return { image: imageDataUrl, headline: slide.headline, subtext: slide.subtext || '' };
    }));"""
new_5 = """      const b64 = imgCall.result;
      const imageDataUrl = await uploadImageToBlob(b64, 'png');

      return { image: imageDataUrl, headline: slide.headline, subtext: slide.subtext || '' };
    }));"""
content = replace_once("endpoint C: upload do Blob (karuzela, slajdy)", old_5, new_5, content)

# ============================================================
# 6) Endpoint D: generate-image-raw
# ============================================================
old_6 = """    res.json({ image: 'data:image/png;base64,' + b64, prompt, referencesUsed: FIXED_REFERENCES });
  } catch(e) {
    console.error('generate-image-raw:', e.message);"""
new_6 = """    const uploadedRawUrl = await uploadImageToBlob(b64, 'png');
    res.json({ image: uploadedRawUrl, prompt, referencesUsed: FIXED_REFERENCES });
  } catch(e) {
    console.error('generate-image-raw:', e.message);"""
content = replace_once("endpoint D: upload do Blob (generate-image-raw)", old_6, new_6, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
