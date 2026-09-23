"use client";

import { LiveStatus } from "./live-status";
import { MarketClocks } from "./market-clock";

/** Statusleiste (Desktop): Börsenuhren links, Live-Status rechts. */
export function MarketBar({ offsetMs }: { offsetMs: number }) {
  return (
    <div className="glass hairline-b sticky top-0 z-30 hidden h-9 items-center justify-between gap-4 px-10 lg:flex">
      <MarketClocks offsetMs={offsetMs} />
      <LiveStatus />
    </div>
  );
}
