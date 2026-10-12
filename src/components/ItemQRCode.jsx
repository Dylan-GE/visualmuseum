import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildARUrl } from '../utils/arLink';

export default function ItemQRCode({ itemId, size = 84 }) {
  const url = buildARUrl(itemId);
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size * 3,
      color: { dark: '#0b1220', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  return (
    <a
      className="modal-qr-code"
      href={url}
      target="_blank"
      rel="noreferrer"
      title={url}
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="AR QR Code" width={size} height={size} /> : null}
    </a>
  );
}
