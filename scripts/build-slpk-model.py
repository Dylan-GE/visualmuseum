"""Turns an Esri I3S "IntegratedMesh" scene layer package (.slpk, 4 GB of LOD tiles) into one
small unlit GLB for the "三維模型" viewer pages.

  python scripts/build-slpk-model.py <in.slpk> <out.glb> [--tris 1500000] [--flip-v]

How: read every node page, then refine the LOD tree greedily (always splitting the node with
the most triangles) until the triangle budget is reached, so the whole area ends up at an even
detail level. Each chosen node keeps its own 512 px JPEG as one glTF primitive. I3S stores
vertices as (dLon deg, dLat deg, dZ m) offsets from the node centre; they are turned into a
local metric frame (x east, y up, z = -north) centred on the footprint with the lowest point
at y = 0, same convention as build-site-model.mjs.

Needs: pip install numpy
"""
import argparse
import gzip
import heapq
import json
import math
import struct
import zipfile

import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument('slpk')
ap.add_argument('out')
ap.add_argument('--tris', type=int, default=1_500_000, help='triangle budget for the whole model')
ap.add_argument('--flip-v', action='store_true', help='flip V (I3S UV origin vs glTF)')
args = ap.parse_args()

z = zipfile.ZipFile(args.slpk)
names = set(z.namelist())


def read(name):
    data = z.read(name)
    return gzip.decompress(data) if name.endswith('.gz') else data


layer = json.loads(read('3dSceneLayer.json.gz'))
ext = layer['fullExtent']
lon0 = (ext['xmin'] + ext['xmax']) / 2
lat0 = (ext['ymin'] + ext['ymax']) / 2
phi = math.radians(lat0)
# metres per degree (WGS84 series)
M_LON = 111412.84 * math.cos(phi) - 93.5 * math.cos(3 * phi)
M_LAT = 111132.95 - 559.82 * math.cos(2 * phi)

nodes = []
page = 0
while f'nodepages/{page}.json.gz' in names:
    nodes += json.loads(read(f'nodepages/{page}.json.gz'))['nodes']
    page += 1
print(f'{len(nodes)} nodes')


def tris(i):
    mesh = nodes[i].get('mesh')
    return mesh['geometry']['vertexCount'] // 3 if mesh else 0


# ---- choose a cut through the LOD tree ----
# Always refine the coarsest node (most ground area per triangle) whose children still fit in
# the budget, so the detail ends up even across the whole area.
def coarseness(i):
    h = sorted(nodes[i]['obb']['halfSize'])
    return h[2] * h[1] / max(tris(i), 1)


heap = [(-coarseness(0), 0)]
final = []
total = tris(0)
while heap:
    _, i = heapq.heappop(heap)
    kids = nodes[i].get('children') or []
    if not kids:
        final.append(i)
        continue
    kid_tris = sum(tris(k) for k in kids)
    if total - tris(i) + kid_tris > args.tris and nodes[i].get('mesh'):
        final.append(i)
        continue
    total += kid_tris - tris(i)
    for k in kids:
        heapq.heappush(heap, (-coarseness(k), k))
final = [i for i in final if nodes[i].get('mesh')]
print(f'cut: {len(final)} nodes, {sum(tris(i) for i in final):,} triangles')

# ---- decode nodes ----
parts = []
for i in final:
    n = nodes[i]
    res = n['mesh']['geometry']['resource']
    data = read(f'nodes/{res}/geometries/0.bin.gz')
    vc, _ = struct.unpack('<II', data[:8])
    pos = np.frombuffer(data, dtype='<f4', count=vc * 3, offset=8).reshape(-1, 3).astype(np.float64)
    uv = np.frombuffer(data, dtype='<f4', count=vc * 2, offset=8 + vc * 24).reshape(-1, 2).astype(np.float32)
    cx, cy, cz = n['obb']['center']
    east = (cx + pos[:, 0] - lon0) * M_LON
    north = (cy + pos[:, 1] - lat0) * M_LAT
    up = cz + pos[:, 2]
    xyz = np.stack([east, up, -north], axis=1)
    if args.flip_v:
        uv = uv.copy()
        uv[:, 1] = 1.0 - uv[:, 1]
    jpg = z.read(f'nodes/{res}/textures/0.jpg')
    parts.append({'xyz': xyz, 'uv': uv, 'jpg': jpg})

allxyz = np.concatenate([p['xyz'] for p in parts])
lo, hi = allxyz.min(axis=0), allxyz.max(axis=0)
shift = np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
print('size (m):', (hi - lo).round(0), 'height range', round(lo[1], 1), '..', round(hi[1], 1))

# ---- weld + write GLB ----
chunks, views, accessors, images, textures, materials, prims = [], [], [], [], [], [], []
length = 0


def add_view(buf, target=None):
    global length
    pad = (-length) % 4
    if pad:
        chunks.append(b'\0' * pad)
        length += pad
    view = {'buffer': 0, 'byteOffset': length, 'byteLength': len(buf)}
    if target:
        view['target'] = target
    chunks.append(buf)
    length += len(buf)
    views.append(view)
    return len(views) - 1


def add_acc(view, ctype, count, typ, **extra):
    accessors.append({'bufferView': view, 'componentType': ctype, 'count': count, 'type': typ, **extra})
    return len(accessors) - 1


out_tris = 0
for p in parts:
    xyz = (p['xyz'] - shift).astype(np.float32)
    rows = np.concatenate([xyz, p['uv']], axis=1)
    uniq, inverse = np.unique(rows, axis=0, return_inverse=True)
    idx = inverse.reshape(-1).astype(np.uint16 if len(uniq) < 65535 else np.uint32)
    out_tris += len(idx) // 3
    img_view = add_view(p['jpg'])
    images.append({'bufferView': img_view, 'mimeType': 'image/jpeg'})
    textures.append({'source': len(images) - 1, 'sampler': 0})
    materials.append({
        'doubleSided': True,
        'extensions': {'KHR_materials_unlit': {}},
        'pbrMetallicRoughness': {'baseColorTexture': {'index': len(textures) - 1}, 'metallicFactor': 0, 'roughnessFactor': 1},
    })
    pv = add_view(np.ascontiguousarray(uniq[:, :3]).tobytes(), 34962)
    uvv = add_view(np.ascontiguousarray(uniq[:, 3:5]).tobytes(), 34962)
    iv = add_view(idx.tobytes(), 34963)
    a_pos = add_acc(pv, 5126, len(uniq), 'VEC3', min=uniq[:, :3].min(axis=0).tolist(), max=uniq[:, :3].max(axis=0).tolist())
    a_uv = add_acc(uvv, 5126, len(uniq), 'VEC2')
    a_idx = add_acc(iv, 5123 if idx.dtype == np.uint16 else 5125, len(idx), 'SCALAR')
    prims.append({'attributes': {'POSITION': a_pos, 'TEXCOORD_0': a_uv}, 'indices': a_idx, 'material': len(materials) - 1})

doc = {
    'asset': {'version': '2.0', 'generator': 'build-slpk-model.py'},
    'extensionsUsed': ['KHR_materials_unlit'],
    'scene': 0,
    'scenes': [{'nodes': [0]}],
    'nodes': [{'mesh': 0, 'name': 'terrain', 'extras': {'shift': shift.tolist()}}],
    'meshes': [{'primitives': prims}],
    'materials': materials,
    'textures': textures,
    'images': images,
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
    'accessors': accessors,
    'bufferViews': views,
    'buffers': [{'byteLength': length + ((-length) % 4)}],
}
js = json.dumps(doc).encode()
js += b' ' * ((-len(js)) % 4)
bin_data = b''.join(chunks) + b'\0' * ((-length) % 4)
total_len = 12 + 8 + len(js) + 8 + len(bin_data)
with open(args.out, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total_len))
    f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
    f.write(struct.pack('<II', len(bin_data), 0x004E4942) + bin_data)
print(f'wrote {args.out}: {total_len / 1e6:.1f} MB, {out_tris:,} triangles, {len(materials)} textures')
