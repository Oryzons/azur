import { useState } from 'react';
import { Ship } from 'lucide-react';
import { boatCoverPhotoSrc } from '@/lib/tabletBoatMedia';
import type { TabletBoatRow } from '@/stores/checkFlow';

type Props = {
  boat: TabletBoatRow;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
};

export function TabletBoatCoverImage({
  boat,
  className = 'relative h-full w-full bg-zinc-800',
  imgClassName = 'absolute inset-0 h-full w-full object-cover',
  fallbackClassName = 'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-900',
}: Props) {
  const src = boatCoverPhotoSrc(boat);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div className={className}>
      {showImage ? (
        <img
          src={src!}
          alt=""
          className={imgClassName}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={fallbackClassName}>
          <Ship className="h-14 w-14 text-white/20" strokeWidth={1.25} aria-hidden />
        </div>
      )}
    </div>
  );
}
