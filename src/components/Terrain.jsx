import { useGLTF } from '@react-three/drei';
import { assetUrl } from '../utils/assetUrl';

const MODEL_URL = assetUrl('/models/scene/main_scene.glb');

export default function Terrain() {
  const { scene } = useGLTF(MODEL_URL);
  return <primitive object={scene} />;
}

useGLTF.preload(MODEL_URL);
