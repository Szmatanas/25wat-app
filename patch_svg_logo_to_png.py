import io

PATH = "server.js"
with io.open(PATH, "r", encoding="utf-8") as f:
    content = f.read()

ANCHOR = """    const logoRow = logoRes.rows[0] || null;
    const logoDataUrl = logoRow ? `data:${logoRow.mime_type || 'image/png'};base64,${logoRow.file_data.toString('base64')}` : null;
    const referenceImages = refRes.rows.map(r => ({ base64: r.file_data.toString('base64'), mime: r.mime_type || 'image/png' }));

    return { brandName, logoDataUrl, referenceImages, aiContextText, colorPairs };"""
assert content.count(ANCHOR) == 1, f"ANCHOR count = {content.count(ANCHOR)}"

NEW = """    const logoRow = logoRes.rows[0] || null;
    let logoDataUrl = null;
    if (logoRow) {
      const isSvg = logoRow.mime_type === 'image/svg+xml' || (logoRow.filename && /\\.svg$/i.test(logoRow.filename));
      if (isSvg) {
        try {
          const pngBuf = await sharp(logoRow.file_data).png().toBuffer();
          logoDataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;
        } catch (svgErr) {
          console.error('logo svg->png convert:', svgErr.message);
          logoDataUrl = `data:${logoRow.mime_type || 'image/png'};base64,${logoRow.file_data.toString('base64')}`;
        }
      } else {
        logoDataUrl = `data:${logoRow.mime_type || 'image/png'};base64,${logoRow.file_data.toString('base64')}`;
      }
    }
    const referenceImages = await Promise.all(refRes.rows.map(async (r) => {
      if (r.mime_type === 'image/svg+xml') {
        try {
          const pngBuf = await sharp(r.file_data).png().toBuffer();
          return { base64: pngBuf.toString('base64'), mime: 'image/png' };
        } catch (svgErr) {
          console.error('reference svg->png convert:', svgErr.message);
        }
      }
      return { base64: r.file_data.toString('base64'), mime: r.mime_type || 'image/png' };
    }));

    return { brandName, logoDataUrl, referenceImages, aiContextText, colorPairs };"""
content = content.replace(ANCHOR, NEW, 1)

with io.open(PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("OK: logo/referenceImages SVG konwertowane do PNG (sharp) przed wyslaniem do OpenAI generate-image")
