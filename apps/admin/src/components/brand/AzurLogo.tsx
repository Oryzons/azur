const PALETTE = {
  deep: '#1B4068',
  blue: '#416B9F',
  white: '#FFFFFF',
} as const;

const FONT = "'Outfit', system-ui, -apple-system, 'Segoe UI', sans-serif";

const WAVE_FRONT = 'M9 28 C 14 22 19 22 24 28 C 29 34 34 34 39 28';
const WAVE_BACK = 'M9 20 C 14 14 19 14 24 20 C 29 26 34 26 39 20';

type Tone = 'brand' | 'light';

type AzurLogoProps = Readonly<{
  variant?: 'mark' | 'wordmark' | 'full';
  className?: string;
  /** brand : badge bleu / texte bleu (fond clair). light : badge blanc / texte blanc (fond sombre). */
  tone?: Tone;
  /** Active l’animation d’entrée (badge, tracé des vagues, flottement). */
  animated?: boolean;
  title?: string;
}>;

function tokens(tone: Tone) {
  if (tone === 'light') {
    return { badge: PALETTE.white, wave: PALETTE.deep, text: PALETTE.white };
  }
  return { badge: PALETTE.deep, wave: PALETTE.white, text: PALETTE.deep };
}

function WaveBadge(props: Readonly<{ tone: Tone; animated?: boolean }>) {
  const { tone, animated } = props;
  const t = tokens(tone);
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={48}
        height={48}
        rx={13}
        fill={t.badge}
        className={animated ? 'bc-logo-badge' : undefined}
      />
      <g fill="none" stroke={t.wave} strokeLinecap="round" strokeLinejoin="round">
        <path
          d={WAVE_BACK}
          strokeWidth={2.6}
          opacity={0.55}
          pathLength={animated ? 100 : undefined}
          className={animated ? 'bc-wave-draw' : undefined}
          style={animated ? { animationDelay: '220ms' } : undefined}
        />
        <path
          d={WAVE_FRONT}
          strokeWidth={3.4}
          pathLength={animated ? 100 : undefined}
          className={animated ? 'bc-wave-draw' : undefined}
          style={animated ? { animationDelay: '380ms' } : undefined}
        />
      </g>
    </g>
  );
}

export function AzurLogo(props: AzurLogoProps) {
  const { variant = 'full', className, tone = 'brand', animated = false, title = 'Azure' } = props;
  const t = tokens(tone);

  if (variant === 'mark') {
    return (
      <svg
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label={title}
        shapeRendering="geometricPrecision"
      >
        <title>{title}</title>
        <g className={animated ? 'bc-logo-float' : undefined}>
          <WaveBadge tone={tone} animated={animated} />
        </g>
      </svg>
    );
  }

  if (variant === 'wordmark') {
    return (
      <svg
        viewBox="0 0 120 48"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label={title}
        shapeRendering="geometricPrecision"
      >
        <title>{title}</title>
        <text x="0" y="34" fill={t.text} fontFamily={FONT} fontSize={30} fontWeight={600} letterSpacing="0.01em">
          Azure
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 188 56"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={title}
      shapeRendering="geometricPrecision"
    >
      <title>{title}</title>
      <g className={animated ? 'bc-logo-float' : undefined}>
        <g transform="translate(0 4)">
          <WaveBadge tone={tone} animated={animated} />
        </g>
        <text
          x="62"
          y="38"
          fill={t.text}
          fontFamily={FONT}
          fontSize={32}
          fontWeight={600}
          letterSpacing="0.01em"
          className={animated ? 'bc-logo-word' : undefined}
          style={animated ? { animationDelay: '520ms' } : undefined}
        >
          Azure
        </text>
      </g>
    </svg>
  );
}

export { PALETTE as AZUR_LOGO_PALETTE };
