const fs = require('fs');
const path = require('path');

const NAMES = ['TunnelA1','TunnelA2','TunnelA3','TunnelA4','TunnelA5','TunnelA6','TunnelA7','TunnelA8__1_','TunnelA9','TunnelA10','TunnelB','TunnelC','TunnelD','SlopeA','SlopeB','SlopeG','Slope18'];

for (const name of NAMES) {
  const p = path.join('tunnel_pieces', name, 'piece.obj');
  if (!fs.existsSync(p)) { console.log(name, '-> FILE MISSING'); continue; }
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split('\n');
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity;
  let vCount=0, fCount=0;
  for (const line of lines) {
    if (line.startsWith('v ')) {
      const [,x,y,z] = line.trim().split(/\s+/).map((s,i)=> i===0?s:parseFloat(s));
      vCount++;
      if (x<minX)minX=x; if(x>maxX)maxX=x;
      if (y<minY)minY=y; if(y>maxY)maxY=y;
      if (z<minZ)minZ=z; if(z>maxZ)maxZ=z;
    } else if (line.startsWith('f ')) fCount++;
  }
  const sx=(maxX-minX).toFixed(2), sy=(maxY-minY).toFixed(2), sz=(maxZ-minZ).toFixed(2);
  console.log(name.padEnd(14), 'verts='+vCount, 'faces='+fCount, 'size(x,y,z)=', sx, sy, sz);
}
