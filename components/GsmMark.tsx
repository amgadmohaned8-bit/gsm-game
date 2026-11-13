// GSM mark: a "G" drawn as a pitch centre circle.
// Open arc = the circle, bar + spot = halfway line meeting the centre spot,
// ticks top and bottom = the halfway line leaving the pitch.

type Props = {
  size?: number;
  className?: string;
};

export default function GsmMark({ size = 48, className }: Props) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="gsm-mark-fill" x1="10" y1="4" x2="54" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7DB96" />
          <stop offset=".55" stopColor="#E3B258" />
          <stop offset="1" stopColor="#A47A2C" />
        </linearGradient>
      </defs>
      <path
        d="M50.4 16.6A24 24 0 1 0 56 32H34"
        stroke="url(#gsm-mark-fill)"
        strokeWidth="5.5"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <path d="M32 2.5v6M32 55.5v6" stroke="url(#gsm-mark-fill)" strokeWidth="3" />
      <circle cx="32" cy="32" r="3.4" fill="url(#gsm-mark-fill)" />
    </svg>
  );
}
