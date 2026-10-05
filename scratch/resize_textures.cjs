const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = 'D:/Project/VirtualMuseum/scratch/tunnel_pieces';
const MAX_SIZE = 1024;

async function run() {
  const pieceDirs = fs.readdirSync(ROOT);
  for (const dir of pieceDirs) {
    const pieceDir = path.join(ROOT, dir);
    if (!fs.statSync(pieceDir).isDirectory()) continue;
    const files = fs.readdirSync(pieceDir).filter((f) => f.endsWith('.png'));
    for (const f of files) {
      const fullPath = path.join(pieceDir, f);
      const before = fs.statSync(fullPath).size;
      const img = sharp(fullPath);
      const meta = await img.metadata();
      const resized = img.resize(Math.min(meta.width, MAX_SIZE), Math.min(meta.height, MAX_SIZE));
      const outPath = fullPath; // overwrite in place
      const tmpPath = fullPath + '.tmp.png';
      await resized.png({ compressionLevel: 9 }).toFile(tmpPath);
      fs.renameSync(tmpPath, outPath);
      const after = fs.statSync(outPath).size;
      console.log(dir, f, meta.width + 'x' + meta.height, '->', MAX_SIZE, `(${(before/1e6).toFixed(1)}MB -> ${(after/1e6).toFixed(1)}MB)`);
    }
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
