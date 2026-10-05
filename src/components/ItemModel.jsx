import { Suspense, useEffect, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { applyColorOverride, fitObjectToGround } from '../utils/bimModel';
import ErrorBoundary from './ErrorBoundary';

function LoadedObj({ objUrl, mtlUrl, color, onBounds }) {
  const materials = useLoader(MTLLoader, mtlUrl);
  const obj = useLoader(OBJLoader, objUrl, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  const { instance, size, center } = useMemo(() => {
    const clone = obj.clone();
    applyColorOverride(clone, color);
    const { size: sizeVec, center: centerVec } = fitObjectToGround(clone);
    return { instance: clone, size: sizeVec, center: centerVec };
  }, [obj, color]);

  useEffect(() => {
    onBounds?.(size, center);
  }, [size, center, onBounds]);

  return <primitive object={instance} />;
}

export default function ItemModel({ objUrl, mtlUrl, color, fallback, onBounds }) {
  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedObj objUrl={objUrl} mtlUrl={mtlUrl} color={color} onBounds={onBounds} />
      </Suspense>
    </ErrorBoundary>
  );
}
