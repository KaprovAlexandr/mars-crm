import { useEffect, useState } from "react";

/** Локальный силуэт вместо внешнего URL; при битой ссылке Google/Firebase показываем то же самое. */
export function ProfilePhotoFace({
  photoSrc,
  alt,
  className,
}: {
  photoSrc: string | null;
  alt: string;
  className?: string;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  useEffect(() => {
    setImgBroken(false);
  }, [photoSrc]);

  if (!photoSrc || imgBroken) {
    return (
      <svg className={className} viewBox="0 0 64 64" role="img" aria-label={alt}>
        <circle cx="32" cy="32" r="32" fill="#E4E7EC" />
        <circle cx="32" cy="24" r="11" fill="#9CA6B8" />
        <path
          d="M12 54c2-12 10-18 20-18s18 6 20 18"
          fill="none"
          stroke="#9CA6B8"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <img
      src={photoSrc}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setImgBroken(true)}
    />
  );
}
