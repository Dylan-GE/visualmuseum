import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export const tunnelPieceUrl = (name) => `/models/tunnel_pieces/${name}.glb`;

export function withDraco(loader) {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  loader.setDRACOLoader(dracoLoader);
}
