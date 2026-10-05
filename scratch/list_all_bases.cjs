const fs = require('fs');
const path = require('path');

const SRC_DIR = 'S:/Project/14049/FlyingData/Scene_BIM/olddata/地下礦場';
const OBJ_PATH = path.join(SRC_DIR, 'bg.obj');

function baseName(objName) {
  return objName.replace(/_+\d+(__\d+)?$/, '');
}

console.log('Reading', OBJ_PATH, '...');
const objText = fs.readFileSync(OBJ_PATH, 'utf8');
const lines = objText.split('\n');
console.log('Total lines:', lines.length);

const counts = new Map();
for (const line of lines) {
  if (line.startsWith('o ')) {
    const name = line.slice(2).trim();
    const base = baseName(name);
    counts.set(base, (counts.get(base) || 0) + 1);
  }
}

const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log('Total unique base names:', entries.length);
fs.writeFileSync('all_base_names.txt', entries.map(([n, c]) => `${c}\t${n}`).join('\n'), 'utf8');
console.log('Written to all_base_names.txt');
