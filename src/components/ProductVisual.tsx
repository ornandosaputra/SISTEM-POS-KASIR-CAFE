import { useState } from 'react';
import imgLatte from '../assets/images/drink_coffee_latte_1793284497810.jpg';
import imgAmericano from '../assets/images/drink_iced_americano_1793284497915.jpg';
import imgV60 from '../assets/images/drink_v60_cream_1793284499785.jpg';
import imgCroissant from '../assets/images/food_butter_croissant_1793284500380.jpg';
import imgAvatarAlbert from '../assets/images/avatar_albert_barista_1793284500799.jpg';

export const ALBERT_AVATAR_URL = imgAvatarAlbert;

const PHOTO_MAP: Record<string, string> = {
  latte: imgLatte,
  americano: imgAmericano,
  v60: imgV60,
  croissant: imgCroissant,
};

interface ProductVisualProps {
  imageKey: string;
  alt: string;
  className?: string;
}

export function ProductVisual({ imageKey, alt, className = 'w-full h-full' }: ProductVisualProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const photoSrc = PHOTO_MAP[imageKey];

  if (photoSrc && !imgFailed) {
    return (
      <div
        className={`relative overflow-hidden bg-[#F6F6F6] dark:bg-[#232730] flex items-center justify-center ${className}`}
      >
        <img
          src={photoSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[#F6F6F6] dark:bg-[#232730] flex items-center justify-center p-2 ${className}`}
    >
      {imageKey === 'cappuccino' && (
        <svg viewBox="0 0 120 140" className="w-4/5 h-4/5 drop-shadow-sm" aria-label={alt}>
          <defs>
            <linearGradient id="cappFoam" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFDF9" />
              <stop offset="100%" stopColor="#F3E5D0" />
            </linearGradient>
            <linearGradient id="cappBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5C3317" />
              <stop offset="48%" stopColor="#EFE3D3" />
              <stop offset="82%" stopColor="#D7B38C" />
              <stop offset="100%" stopColor="#3B1E0D" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="126" rx="26" ry="5" fill="rgba(0,0,0,0.09)" />
          <path d="M36 26 L84 26 L77 120 Q76 125 60 125 Q44 125 43 120 Z" fill="url(#cappBody)" />
          <path d="M36 26 Q60 18 84 26 L83 38 Q60 42 37 38 Z" fill="url(#cappFoam)" />
          <circle cx="54" cy="27" r="1.5" fill="#7B4824" />
          <circle cx="62" cy="25" r="1.8" fill="#7B4824" />
          <circle cx="66" cy="28" r="1.3" fill="#7B4824" />
          <rect x="48" y="48" width="9" height="9" rx="2" fill="rgba(255,255,255,0.45)" transform="rotate(-12 52 52)" />
          <rect x="63" y="56" width="8" height="8" rx="2" fill="rgba(255,255,255,0.38)" transform="rotate(14 67 60)" />
          <path d="M36 26 L84 26 L77 120 Q76 125 60 125 Q44 125 43 120 Z" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.6" />
        </svg>
      )}

      {imageKey === 'matcha' && (
        <svg viewBox="0 0 120 140" className="w-4/5 h-4/5 drop-shadow-sm" aria-label={alt}>
          <defs>
            <linearGradient id="matchaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F7942" />
              <stop offset="45%" stopColor="#8FBC78" />
              <stop offset="100%" stopColor="#F5F2EB" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="126" rx="25" ry="5" fill="rgba(0,0,0,0.08)" />
          <path d="M37 26 L83 26 L77 120 Q60 125 43 120 Z" fill="url(#matchaGrad)" />
          <path d="M37 26 L83 26 L77 120 Q60 125 43 120 Z" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" />
        </svg>
      )}

      {imageKey === 'chocolate' && (
        <svg viewBox="0 0 120 140" className="w-4/5 h-4/5 drop-shadow-sm" aria-label={alt}>
          <defs>
            <linearGradient id="chocGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3E2215" />
              <stop offset="65%" stopColor="#6D412A" />
              <stop offset="100%" stopColor="#2A150C" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="126" rx="25" ry="5" fill="rgba(0,0,0,0.09)" />
          <path d="M37 28 L83 28 L77 120 Q60 125 43 120 Z" fill="url(#chocGrad)" />
          <path d="M40 28 Q60 14 80 28 Z" fill="#FAF5EF" />
          <path d="M37 28 L83 28 L77 120 Q60 125 43 120 Z" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
        </svg>
      )}

      {!['cappuccino', 'matcha', 'chocolate'].includes(imageKey) && (
        <svg viewBox="0 0 120 120" className="w-4/5 h-4/5 drop-shadow-sm" aria-label={alt}>
          <circle cx="60" cy="64" r="38" fill="#EFE8DF" />
          <rect x="34" y="44" width="52" height="34" rx="10" fill="#D48B54" />
          <path d="M38 54 Q60 44 82 54" stroke="#FFF7EE" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M42 64 Q60 56 78 64" stroke="#6E3B1B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
