import sharp from 'sharp';
import fs from 'fs';

async function main() {
  // 1. Wczytaj zdjęcie użytkownika
  const photoBuf = fs.readFileSync('/Users/jandurazinski/Desktop/gal-1.jpg');

  // 2. Wczytaj SVG flubbera, wymuś biały fill (kolor nieistotny — liczy się tylko kształt/alpha)
  let svgText = fs.readFileSync('./assets/graphic/flubber/flubber-neon-1.svg', 'utf8');
  svgText = svgText.replace(/fill="#[A-Fa-f0-9]+"/, 'fill="#FFFFFF"');

  const targetW = 800, targetH = 856; // proporcje z viewBox 449x480, przeskalowane

  // 3. Rasteryzuj SVG do maski PNG (kształt = biały/nieprzezroczysty, reszta = przezroczysta)
  const maskBuf = await sharp(Buffer.from(svgText))
    .resize(targetW, targetH)
    .png()
    .toBuffer();

  // 4. Przytnij zdjęcie użytkownika do tych samych wymiarów (cover = wypełnia, przycina nadmiar)
  const photoResized = await sharp(photoBuf)
    .resize(targetW, targetH, { fit: 'cover' })
    .png()
    .toBuffer();

  // 5. Wytnij zdjęcie w kształt maski (dest-in = zostaw tylko piksele zdjęcia tam gdzie maska jest nieprzezroczysta)
  const clipped = await sharp(photoResized)
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png()
    .toBuffer();

  fs.writeFileSync('/tmp/test-clipped-result.png', clipped);
  console.log('✓ Zapisano /tmp/test-clipped-result.png');
}

main().catch(e => console.error('BŁĄD:', e.message));
