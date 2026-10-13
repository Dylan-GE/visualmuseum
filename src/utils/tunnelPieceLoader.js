import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { assetUrl } from './assetUrl';

export const tunnelPieceUrl = (name) => assetUrl(`/models/tunnel_pieces/${name}.glb`);

export function withDraco(loader) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(assetUrl('/draco/'));
  loader.setDRACOLoader(dracoLoader);
}
