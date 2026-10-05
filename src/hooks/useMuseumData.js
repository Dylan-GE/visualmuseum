import { useEffect, useState } from 'react';

export function useMuseumData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/museum_data.json')
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
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
