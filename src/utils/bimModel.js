import { Box3, Vector3 } from 'three';

// BIM/IFC exports are Z-up; three.js is Y-up.
export const IFC_TO_THREE_ROTATION = [-Math.PI / 2, 0, 0];

// Each BIM export's own origin sits at an arbitrary point (often not the model's
// base), so after the Z-up->Y-up rotation many models end up partly or fully
// below y=0. Re-measure post-rotation and lift the model so its lowest point
// rests on y=0. Mutates `object` in place; returns its post-fit size/center.
export function fitObjectToGround(object) {
  object.rotation.set(...IFC_TO_THREE_ROTATION);
  object.updateMatrixWorld(true);
  const box = new Box3().setFromObject(object);
  const groundOffset = Number.isFinite(box.min.y) ? -box.min.y : 0;
  const size = new Vector3();
  const center = new Vector3();
  box.getSize(size);
  box.getCenter(center);
  center.y += groundOffset;
  object.position.set(0, groundOffset, 0);
  return { size, center };
}

// BIM/IFC materials only carry a flat Kd color (no textures), which often
// doesn't match a reference photo. Overriding it means cloning each mesh's
// material first — meshes from the shared/cached loaded object must not have
// their original material mutated in place, since other instances may reuse it.
export function applyColorOverride(object, colorHex) {
  if (!colorHex) return;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const wasArray = Array.isArray(child.material);
    const materials = wasArray ? child.material : [child.material];
    const cloned = materials.map((m) => {
      const c = m.clone();
      c.color.set(colorHex);
      return c;
    });
    child.material = wasArray ? cloned : cloned[0];
  });
}
