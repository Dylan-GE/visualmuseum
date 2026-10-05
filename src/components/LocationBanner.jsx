export default function LocationBanner({ zoneName }) {
  if (!zoneName) return null;
  return (
    <div className="location-banner">
      <span className="location-banner-dot" />
      {zoneName}
    </div>
  );
}
