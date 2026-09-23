import { formatNumber, formatPercent } from "@/lib/format";
import { ArrowDownIcon, ArrowUpIcon } from "../icons";

export function trendClass(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return "text-fg-2";
  return value > 0 ? "text-up" : "text-down";
}

function srPrefix(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return "unverändert";
  return value > 0 ? "gestiegen um" : "gefallen um";
}

/**
 * Prozentveränderung mit Pfeil + Vorzeichen – Farbe ist nie das einzige
 * Merkmal. Screenreader lesen „gestiegen um 1,2 %“.
 */
export function ChangeText({
  value,
  digits = 2,
  className = "",
  arrow = true,
  absolute,
}: {
  value: number;
  digits?: number;
  className?: string;
  arrow?: boolean;
  absolute?: { value: number; digits?: number };
}) {
  const up = value > 0.005;
  const down = value < -0.005;
  return (
    <span className={`tnum inline-flex items-center gap-0.5 font-medium ${trendClass(value)} ${className}`}>
      <span className="sr-only">{srPrefix(value)} </span>
      {arrow && up && <ArrowUpIcon size={13} strokeWidth={2.4} />}
      {arrow && down && <ArrowDownIcon size={13} strokeWidth={2.4} />}
      {absolute && (
        <span aria-hidden="true" className="mr-1">
          {formatNumber(absolute.value, absolute.digits ?? 2, { sign: true })}
        </span>
      )}
      <span aria-hidden="true">
        {absolute ? `(${formatPercent(value, digits)})` : formatPercent(value, digits)}
      </span>
      <span className="sr-only">{formatPercent(Math.abs(value), digits, { sign: false })}</span>
    </span>
  );
}

/** Pill-Variante für Listen (Hintergrund getönt, Text farbig). */
export function ChangePill({ value, digits = 2, className = "" }: { value: number; digits?: number; className?: string }) {
  const bg =
    !Number.isFinite(value) || Math.abs(value) < 0.005 ? "bg-surface-2" : value > 0 ? "bg-up-soft" : "bg-down-soft";
  return (
    <span className={`inline-flex min-w-[4.75rem] justify-end rounded-lg px-2 py-1 text-[0.8125rem] ${bg} ${className}`}>
      <ChangeText value={value} digits={digits} />
    </span>
  );
}
