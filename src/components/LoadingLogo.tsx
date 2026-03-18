/**
 * LoadingLogo — Animated Vowel logo used as a loading indicator.
 *
 * Replaces generic spinners with the brand's animated vowel logo for
 * consistent loading states across the app.
 */

import VowelLogo from './VowelLogo';

/** Props for {@link LoadingLogo}. */
interface LoadingLogoProps {
  /** Logical size in CSS pixels. @default 28 */
  size?: number;
  /** Optional additional class names for the wrapper. */
  className?: string;
}

/**
 * Renders the animated Vowel logo as a loading indicator.
 * Use in place of Loader2/spinner for brand-consistent loading states.
 */
export default function LoadingLogo({ size = 28, className = '' }: LoadingLogoProps) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-label="Loading"
    >
      <VowelLogo size={size} />
    </div>
  );
}
