import { useEffect, useState } from 'react';
import { assetUrl } from '../utils/assetUrl';

// museum_data.json stores root-absolute model paths; prefix them once here so
// every consumer gets URLs that also work when the site is served from a sub-path.
function withBaseUrls(json) {
  return {
    ...json,
    items: (json.items ?? []).map((item) => ({
      ...item,
      model_url: assetUrl(item.model_url),
      ar: item.ar ? { ...item.ar, glb: assetUrl(item.ar.glb) } : item.ar,
    })),
  };
}

export function useMuseumData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(assetUrl('/data/museum_data.json'))
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(withBaseUrls(json));
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, loading: !data && !error };
}
