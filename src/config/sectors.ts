export const SECTORS = [
  { id: "tech", label: "Technologie", short: "Tech" },
  { id: "communication", label: "Kommunikation", short: "Komm." },
  { id: "consumer-discretionary", label: "Zyklischer Konsum", short: "Konsum zykl." },
  { id: "consumer-staples", label: "Basiskonsum", short: "Basiskonsum" },
  { id: "health", label: "Gesundheit", short: "Gesundheit" },
  { id: "financials", label: "Finanzen", short: "Finanzen" },
  { id: "industrials", label: "Industrie", short: "Industrie" },
  { id: "energy", label: "Energie", short: "Energie" },
  { id: "materials", label: "Grundstoffe", short: "Grundstoffe" },
  { id: "utilities", label: "Versorger", short: "Versorger" },
  { id: "real-estate", label: "Immobilien", short: "Immobilien" },
] as const;

export type SectorId = (typeof SECTORS)[number]["id"];

const byId = new Map<string, (typeof SECTORS)[number]>(SECTORS.map((s) => [s.id, s]));

export function sectorLabel(id: SectorId): string {
  return byId.get(id)?.label ?? id;
}

export function sectorShort(id: SectorId): string {
  return byId.get(id)?.short ?? id;
}

export function isSectorId(value: string): value is SectorId {
  return byId.has(value);
}
