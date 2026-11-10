// Shrinks a GLB for the web: weld/dedupe, quantize vertex data (KHR_mesh_quantization) and
// compress it with meshopt (EXT_meshopt_compression). Typically 3-4x smaller for the big
// terrain scans; three.js decodes it on the fly (drei's useGLTF loads the meshopt decoder).
//
//   node scripts/compress-glb.mjs <in.glb> <out.glb>
//
// The @gltf-transform packages are only needed for this script and are NOT part of the website:
//   cd <any folder> && npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
//   NODE_PATH=<that folder>/node_modules node scripts/compress-glb.mjs ...
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.env.GLTF_TOOLS ?? process.cwd(), 'noop.js'));
const { NodeIO } = require('@gltf-transform/core');
const { EXTMeshoptCompression, KHRMaterialsUnlit, KHRMeshQuantization } = require('@gltf-transform/extensions');
const { quantize, meshopt } = require('@gltf-transform/functions');
const { MeshoptEncoder, MeshoptDecoder } = require('meshoptimizer');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: compress-glb.mjs <in.glb> <out.glb>');
  process.exit(1);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMaterialsUnlit, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const doc = await io.read(input);
await doc.transform(
  // positions: 14-bit is plenty for a 460 m scene (~3 cm steps); uv 12-bit; keeps colours as they are
  quantize({ quantizePosition: 16, quantizeTexcoord: 14, quantizeColor: 8, quantizeNormal: 10 }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);
await io.write(output, doc);
console.log('wrote', output);
