import type { SectorId } from "@/config/sectors";

const HUE: Record<SectorId, number> = {
  tech: 258,
  communication: 212,
  "consumer-discretionary": 28,
  "consumer-staples": 168,
  health: 330,
  financials: 45,
  industrials: 222,
  energy: 12,
  materials: 95,
  utilities: 188,
  "real-estate": 300,
};

/** Monogramm statt Firmenlogo (keine Markenlogos, keine externen Bilder). */
export function Monogram({
  ticker,
  sector,
  size = 40,
  className = "",
}: {
  ticker: string;
  sector: SectorId;
  size?: number;
  className?: string;
}) {
  const text = ticker.replace(/\..*$/, "").slice(0, 4);
  const fontSize = text.length <= 2 ? size * 0.38 : text.length === 3 ? size * 0.31 : size * 0.26;
  return (
    <span
      aria-hidden="true"
      className={`mono inline-grid shrink-0 place-items-center rounded-[30%] font-semibold tracking-tight ${className}`}
      style={{ width: size, height: size, fontSize, ["--mono-h" as string]: HUE[sector] }}
    >
      {text}
    </span>
  );
}
