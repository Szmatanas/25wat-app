import io, sys

PATH = "index.html"
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

def replace_all_checked(label, old, new, expected_count, content):
    count = content.count(old)
    if count != expected_count:
        changes_failed.append((label, count))
        print(f"[FAIL] {label}: znaleziono {count}x (oczekiwano {expected_count}x) — SKIP")
        return content
    content = content.replace(old, new)
    changes_applied.append(label)
    print(f"[OK]   {label} ({expected_count}x)")
    return content

# ============================================================
# 1) dwHandlePhoto: po wczytaniu FileReadera, wyslij zdjecie na backend -> Vercel Blob
# ============================================================
old_1 = """    var reader = new FileReader();
    reader.onload = function(e){
      window._dwGeneratedPhotoUrl = e.target.result;
      s.style.color = '#7648F8';
      s.textContent = '✓ ' + file.name + ' załadowane — gotowe do kompozycji';
      s.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };"""
new_1 = """    var reader = new FileReader();
    reader.onload = function(e){
      window._dwGeneratedPhotoUrl = e.target.result;
      window._dwUploadedPhotoUrl = null;
      s.style.color = '#7648F8';
      s.textContent = '✓ ' + file.name + ' załadowane — gotowe do kompozycji';
      s.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var API_BASE = window.RV_API_BASE || 'http://localhost:3001';
      fetch(API_BASE + '/api/design/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: e.target.result })
      }).then(function(r){ return r.json(); }).then(function(d){
        if (d && d.url) window._dwUploadedPhotoUrl = d.url;
      }).catch(function(){ /* zostaje base64 jako fallback */ });
    };"""
content = replace_once("dwHandlePhoto: upload zdjecia do Blob w tle", old_1, new_1, content)

# ============================================================
# 2) dwShowPhotoOnly: preferuj trwaly URL z Blob nad base64
# ============================================================
old_2 = """function dwShowPhotoOnly() {
  const photoUrl = window._dwGeneratedPhotoUrl;
  if (!photoUrl) { toast('Najpierw wgraj lub wygeneruj zdjęcie'); return; }"""
new_2 = """function dwShowPhotoOnly() {
  const photoUrl = window._dwUploadedPhotoUrl || window._dwGeneratedPhotoUrl;
  if (!photoUrl) { toast('Najpierw wgraj lub wygeneruj zdjęcie'); return; }"""
content = replace_once("dwShowPhotoOnly: preferuj window._dwUploadedPhotoUrl", old_2, new_2, content)

# ============================================================
# 3) Reset window._dwUploadedPhotoUrl wszedzie, gdzie resetuje sie _dwGeneratedPhotoUrl na null
# ============================================================
old_3 = "window._dwGeneratedPhotoUrl = null;"
new_3 = "window._dwGeneratedPhotoUrl = null;\n  window._dwUploadedPhotoUrl = null;"
content = replace_all_checked("reset window._dwUploadedPhotoUrl obok istniejacych resetow", old_3, new_3, 2, content)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print(f"\n=== PODSUMOWANIE ===")
print(f"Zastosowane: {len(changes_applied)}, nieudane: {len(changes_failed)}")
if changes_failed:
    for label, count in changes_failed:
        print(f"  - {label} (znaleziono {count}x)")
    sys.exit(1)
