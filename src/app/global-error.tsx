"use client";

import "./globals.css";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="de" data-theme="dark">
      <body>
        <title>Fehler · Signal</title>
        <main className="grid min-h-dvh place-items-center px-6 text-center">
          <div className="max-w-sm">
            <h1 className="text-2xl font-bold">Etwas ist schiefgelaufen</h1>
            <p className="mt-2 text-fg-2">Signal konnte nicht geladen werden. Bitte versuche es erneut.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-6 rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent"
            >
              Erneut versuchen
            </button>
            {error.digest && <p className="mt-4 text-xs text-fg-3">Fehler-ID: {error.digest}</p>}
          </div>
        </main>
      </body>
    </html>
  );
}
