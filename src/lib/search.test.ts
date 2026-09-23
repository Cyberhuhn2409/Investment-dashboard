import { describe, expect, it } from "vitest";
import { UNIVERSE } from "@/config/universe";
import { matchScore, normalize, searchInstruments, toSearchEntries } from "./search";

const entries = toSearchEntries(UNIVERSE);

describe("Suche", () => {
  it("normalisiert Umlaute und Sonderzeichen", () => {
    expect(normalize("Münchener Rück")).toBe("munchener ruck");
    expect(normalize("  Deutsche   Börse! ")).toBe("deutsche borse");
  });

  it("exakter Ticker gewinnt", () => {
    expect(searchInstruments(entries, "sap")[0]?.symbol).toBe("SAP.DE");
    expect(searchInstruments(entries, "T")[0]?.symbol).toBe("T");
  });

  it("findet Namen und Aliase", () => {
    expect(searchInstruments(entries, "google")[0]?.symbol).toBe("GOOGL");
    expect(searchInstruments(entries, "rheinm")[0]?.symbol).toBe("RHM.DE");
    expect(searchInstruments(entries, "munchener")[0]?.symbol).toBe("MUV2.DE");
    expect(searchInstruments(entries, "Münchener")[0]?.symbol).toBe("MUV2.DE");
  });

  it("Wortanfänge im Namen", () => {
    const res = searchInstruments(entries, "deutsche").map((e) => e.symbol);
    expect(res).toEqual(expect.arrayContaining(["DBK.DE", "DB1.DE", "DTE.DE"]));
  });

  it("liefert nichts für leere oder unbekannte Anfragen", () => {
    expect(searchInstruments(entries, "")).toEqual([]);
    expect(searchInstruments(entries, "xyzxyz")).toEqual([]);
  });

  it("begrenzt die Trefferzahl", () => {
    expect(searchInstruments(entries, "a", 5).length).toBeLessThanOrEqual(5);
  });

  it("Ticker-Präfix schlägt Teilstring", () => {
    const nvda = entries.find((e) => e.symbol === "NVDA")!;
    expect(matchScore(nvda, "nv")).toBeGreaterThan(matchScore(nvda, "vid"));
  });
});
