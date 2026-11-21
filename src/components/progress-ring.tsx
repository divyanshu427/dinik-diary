import { cn } from "@/lib/utils";

interface ProgressRingProps {
  /** 0–100 */
  percent: number;
  /** Text in the middle, e.g. "5/10". */
  label: string;
  /** Read out by screen readers, e.g. "5 of 10 habits done". */
  ariaLabel: string;
  size?: number;
  className?: string;
}

/** A single-value ring (one hue on a muted track), like the mock-up's "5/8". */
export function ProgressRing({
  percent,
  label,
  ariaLabel,
  size = 64,
  className,
}: ProgressRingProps) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-sm font-semibold tabular-nums">
        {label}
      </span>
    </div>
  );
}
