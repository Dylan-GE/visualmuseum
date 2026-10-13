import ARViewer from './components/ARViewer';
import ARIndex from './components/ARIndex';
import { useMuseumData } from './hooks/useMuseumData';
import { parseARPath } from './utils/arLink';

// Standalone root of the AR-only test site (see scripts/build-ar-site.mjs). It
// deliberately imports nothing from the museum scene, so none of that code is
// shipped in that build.
export default function ARApp() {
  const { data, error } = useMuseumData();
  const itemId = parseARPath(window.location.pathname);
  return itemId ? <ARViewer itemId={itemId} data={data} error={error} /> : <ARIndex data={data} error={error} />;
}
