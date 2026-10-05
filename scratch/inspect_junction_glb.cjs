const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS, KHRDracoMeshCompression } = require('@gltf-transform/extensions');
const draco3d = require('draco3d');

async function main() {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });
  const doc = await io.read('../public/models/tunnel_pieces/TunnelJunction.glb');
  const root = doc.getRoot();

  console.log('Scenes:', root.listScenes().length);
  const scene = root.listScenes()[0];

  function walk(node, parentMatrix, depth) {
    const t = node.getTranslation();
    const r = node.getRotation();
    const s = node.getScale();
    console.log(' '.repeat(depth * 2), 'node', node.getName() || '(unnamed)', 'T=', t, 'R=', r, 'S=', s);
    for (const mesh of [node.getMesh()].filter(Boolean)) {
      for (const prim of mesh.listPrimitives()) {
        const posAcc = prim.getAttribute('POSITION');
        if (posAcc) {
          const arr = posAcc.getArray();
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
          for (let i = 0; i < arr.length; i += 3) {
            const x = arr[i], y = arr[i+1], z = arr[i+2];
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
          }
          console.log(' '.repeat(depth * 2), '  mesh RAW (local, pre-node-transform) bbox: x[', minX.toFixed(3), maxX.toFixed(3), '] y[', minY.toFixed(3), maxY.toFixed(3), '] z[', minZ.toFixed(3), maxZ.toFixed(3), ']');
          console.log(' '.repeat(depth * 2), '  vertex count:', arr.length / 3);
        }
      }
    }
    for (const child of node.listChildren()) walk(child, null, depth + 1);
  }
  for (const node of scene.listChildren()) walk(node, null, 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
