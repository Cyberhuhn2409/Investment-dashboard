import { notFound } from "next/navigation";
import { getInstrument } from "@/config/universe";

/**
 * Prüft das Symbol oberhalb der Lade-Grenze: So antwortet ein unbekanntes
 * Symbol mit echtem HTTP 404, bevor das Streaming des Skeletons beginnt.
 */
export default async function InstrumentLayout({ children, params }: LayoutProps<"/aktie/[symbol]">) {
  const { symbol } = await params;
  if (!getInstrument(symbol)) notFound();
  return children;
}
