import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import { Vector3 } from 'three';

// Minimal WASD + mouse-look walking controller for validation prototypes —
// no collision detection (this is purely for eyeballing whether a layout
// LOOKS navigable by actually moving through it, not a physics simulation).
// Click the canvas to lock the pointer and look around; WASD to move,
// Space/Shift to rise/sink, Escape (or drei's own handling) to release.
export default function FirstPersonWalker({ speed = 3.5 }) {
  const { camera } = useThree();
  const keysRef = useRef({});

  useEffect(() => {
    const onKeyDown = (e) => {
      keysRef.current[e.code] = true;
    };
    const onKeyUp = (e) => {
      keysRef.current[e.code] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const move = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const keys = keysRef.current;
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();

    move.set(0, 0, 0);
    if (keys.KeyW) move.add(forward);
    if (keys.KeyS) move.sub(forward);
    if (keys.KeyD) move.add(right);
    if (keys.KeyA) move.sub(right);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * delta);
      camera.position.add(move);
    }
    if (keys.Space) camera.position.y += speed * delta;
    if (keys.ShiftLeft) camera.position.y -= speed * delta;
  });

  return <PointerLockControls makeDefault />;
}
