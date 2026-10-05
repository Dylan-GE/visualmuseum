import { useGLTF } from '@react-three/drei';

const MODEL_URL = '/models/scene/main_scene.glb';

export default function Terrain() {
  const { scene } = useGLTF(MODEL_URL);
  return <primitive object={scene} />;
}

useGLTF.preload(MODEL_URL);
