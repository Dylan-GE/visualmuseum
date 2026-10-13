"""Thins a coloured LAS/LAZ scan (tunnel interior) into a GLB made of POINTS, placed in
the same frame as the matching terrain GLB from build-site-model.mjs so the two overlay.

  python scripts/build-site-pointcloud.py <scan.las|laz> <out.glb> \
      --origin-e 334584 --origin-n 2778593 --terrain public/models/sites/guoying.glb [--voxel 0.12]

Needs: pip install laspy lazrs numpy
The scan is TWD97 / TM2 (EPSG:3826) metres; the OBJ terrain frame is that minus its
SRSOrigin (metadata.xml), Z up -> Y up, then the terrain GLB's own recentring shift
(stored in its node extras). One point is kept per voxel, which evens out the density.
"""
import argparse
import json
import struct

import laspy
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('scan')
ap.add_argument('out')
ap.add_argument('--origin-e', type=float, required=True)
ap.add_argument('--origin-n', type=float, required=True)
ap.add_argument('--terrain', required=True, help='GLB written by build-site-model.mjs (supplies the recentring shift)')
ap.add_argument('--voxel', type=float, default=0.12, help='voxel edge in metres')
args = ap.parse_args()


def read_shift(path):
    with open(path, 'rb') as f:
        f.seek(12)
        length, _ = struct.unpack('<II', f.read(8))
        doc = json.loads(f.read(length))
    return doc['nodes'][0]['extras']['shift']


cx, min_y, cz = read_shift(args.terrain)
V = args.voxel

kept_keys, kept_pos, kept_rgb = [], [], []
total = 0
with laspy.open(args.scan) as reader:
    for chunk in reader.chunk_iterator(4_000_000):
        total += len(chunk)
        e = np.asarray(chunk.x, dtype=np.float64) - args.origin_e
        n = np.asarray(chunk.y, dtype=np.float64) - args.origin_n
        z = np.asarray(chunk.z, dtype=np.float64)
        # Z-up -> Y-up (x, z, -n), then the terrain's recentring
        x3 = e - cx
        y3 = z - min_y
        z3 = -n - cz
        # global key: use absolute voxel indices (offset by a fixed bias so they stay positive)
        ka = np.stack([np.floor(x3 / V), np.floor(y3 / V), np.floor(z3 / V)], axis=1).astype(np.int64) + (1 << 20)
        key = (ka[:, 0] << 42) | (ka[:, 1] << 21) | ka[:, 2]
        _, first = np.unique(key, return_index=True)
        kept_keys.append(key[first])
        kept_pos.append(np.stack([x3[first], y3[first], z3[first]], axis=1).astype(np.float32))
        kept_rgb.append(
            np.stack([np.asarray(chunk.red)[first], np.asarray(chunk.green)[first], np.asarray(chunk.blue)[first]], axis=1)
        )
        print(f'  read {total:,} points', flush=True)

keys = np.concatenate(kept_keys)
pos = np.concatenate(kept_pos)
rgb = np.concatenate(kept_rgb)
_, first = np.unique(keys, return_index=True)
pos, rgb = pos[first], rgb[first]
# LAS colours are 16-bit (sometimes really 8-bit): scale by what the data uses
scale = 256 if rgb.max() > 255 else 1
rgba = np.empty((len(pos), 4), dtype=np.uint8)
rgba[:, :3] = (rgb // scale).clip(0, 255)
rgba[:, 3] = 255
print(f'kept {len(pos):,} of {total:,} points at {V} m voxels')

# ---- GLB with a single POINTS primitive ----
pos_bytes = pos.tobytes()
col_bytes = rgba.tobytes()
bin_data = pos_bytes + col_bytes  # both multiples of 4
doc = {
    'asset': {'version': '2.0', 'generator': 'build-site-pointcloud.py'},
    'scene': 0,
    'scenes': [{'nodes': [0]}],
    'nodes': [{'mesh': 0, 'name': 'pointcloud'}],
    'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'COLOR_0': 1}, 'mode': 0}]}],
    'accessors': [
        {
            'bufferView': 0,
            'componentType': 5126,
            'count': len(pos),
            'type': 'VEC3',
            'min': pos.min(axis=0).tolist(),
            'max': pos.max(axis=0).tolist(),
        },
        {'bufferView': 1, 'componentType': 5121, 'normalized': True, 'count': len(pos), 'type': 'VEC4'},
    ],
    'bufferViews': [
        {'buffer': 0, 'byteOffset': 0, 'byteLength': len(pos_bytes), 'target': 34962},
        {'buffer': 0, 'byteOffset': len(pos_bytes), 'byteLength': len(col_bytes), 'target': 34962},
    ],
    'buffers': [{'byteLength': len(bin_data)}],
}
json_bytes = json.dumps(doc).encode()
json_bytes += b' ' * ((4 - len(json_bytes) % 4) % 4)
total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
with open(args.out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total_len))
    f.write(struct.pack('<II', len(json_bytes), 0x4E4F534A) + json_bytes)
    f.write(struct.pack('<II', len(bin_data), 0x004E4942) + bin_data)
print(f'wrote {args.out}: {total_len / 1e6:.1f} MB')
