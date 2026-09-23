"use client";

import { useState } from "react";
import type { InstrumentRow } from "@/lib/types";
import { InstrumentRowItem } from "../instrument-row";
import { SegmentedControl } from "../ui/segmented";

type Mode = "up" | "down";

export function Movers({ gainers, losers }: { gainers: InstrumentRow[]; losers: InstrumentRow[] }) {
  const [mode, setMode] = useState<Mode>("up");
  const rows = mode === "up" ? gainers : losers;
  return (
    <div>
      <div className="mb-3 px-4 lg:px-0">
        <SegmentedControl
          label="Bewegungen filtern"
          value={mode}
          onChange={setMode}
          options={[
            { value: "up", label: "Gewinner" },
            { value: "down", label: "Verlierer" },
          ]}
          className="w-full sm:w-auto"
        />
      </div>
      <div className="mx-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface lg:mx-0" aria-live="polite">
        {rows.map((row) => (
          <InstrumentRowItem key={row.symbol} row={row} meta={`${row.ticker} · ${row.exchange}`} />
        ))}
      </div>
    </div>
  );
}
