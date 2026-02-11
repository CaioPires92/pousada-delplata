import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node scripts/optimize-staged-images.mjs <staging-dir>');
  process.exit(1);
}

const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const maxWidth = 1920;

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

async function optimizeImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!exts.has(ext)) return { changed: false, saved: 0 };

  const original = await fs.readFile(filePath);
  const image = sharp(original, { failOnError: false }).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? maxWidth;
  const resized = width > maxWidth ? image.resize({ width: maxWidth, withoutEnlargement: true }) : image;

  let output;
  if (ext === '.webp') {
    output = await resized.webp({ quality: 78 }).toBuffer();
  } else if (ext === '.png') {
    output = await resized.png({ compressionLevel: 9, progressive: true }).toBuffer();
  } else {
    output = await resized.jpeg({ quality: 76, mozjpeg: true, progressive: true }).toBuffer();
  }

  if (output.length >= original.length) return { changed: false, saved: 0 };
  await fs.writeFile(filePath, output);
  return { changed: true, saved: original.length - output.length };
}

async function main() {
  let totalSaved = 0;
  let changedCount = 0;
  let scanned = 0;

  for await (const file of walk(targetDir)) {
    scanned++;
    const result = await optimizeImage(file);
    if (result.changed) {
      changedCount++;
      totalSaved += result.saved;
    }
  }

  console.log(`[optimize-staged-images] scanned=${scanned} changed=${changedCount} savedMB=${(totalSaved / 1024 / 1024).toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
