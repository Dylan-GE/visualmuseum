import { useEffect, useState } from 'react';
import { getModelThumbnail } from '../utils/modelThumbnailRenderer';

export default function ModelThumbnail({ item }) {
  const [src, setSrc] = useState(null);
  const hasRealModel = item.model_url?.endsWith('.obj');

  useEffect(() => {
    if (!hasRealModel) return undefined;
    let cancelled = false;
    const mtlUrl = item.model_url.replace(/\.obj$/, '.mtl');
    getModelThumbnail(item.model_url, mtlUrl, item.color)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.model_url, item.color, hasRealModel]);

  if (!src) {
    return <div className="collection-item-placeholder" />;
  }

  return <img className="collection-item-thumb" src={src} alt={item.name} />;
}
