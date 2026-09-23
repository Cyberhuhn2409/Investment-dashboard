import type { Metadata } from "next";
import Link from "next/link";
import { WifiOffIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-surface-2 text-fg-2">
          <WifiOffIcon size={30} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Du bist offline</h1>
        <p className="mt-2 text-fg-2">
          Ohne Verbindung können wir keine aktuellen Kurse laden. Bereits besuchte Seiten sind weiterhin verfügbar.
        </p>
        <Link href="/" className="press mt-6 inline-flex rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent">
          Erneut versuchen
        </Link>
      </div>
    </div>
  );
}
