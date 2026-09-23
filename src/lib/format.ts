/**
 * Formatierung für deutsche UI-Texte. Zeitzone ist fest Europe/Berlin, damit
 * Server- und Client-Rendering identische Strings erzeugen.
 */
export const TIME_ZONE = "Europe/Berlin";
const LOCALE = "de-DE";

const numberFormats = new Map<string, Intl.NumberFormat>();

function nf(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let f = numberFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, options);
    numberFormats.set(key, f);
  }
  return f;
}

/** Echtes Minuszeichen statt Bindestrich (typografisch sauber, gut lesbar). */
const MINUS = "−";

function withSign(formatted: string, value: number, sign: boolean): string {
  const clean = formatted.replace("-", MINUS);
  if (sign && value > 0) return `+${clean}`;
  return clean;
}

export function formatNumber(value: number, digits = 2, opts: { sign?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "–";
  const rounded = Object.is(Math.round(value * 10 ** digits), -0) ? 0 : value;
  return withSign(
    nf({ minimumFractionDigits: digits, maximumFractionDigits: digits }).format(rounded),
    rounded,
    opts.sign ?? false,
  );
}

export function formatPercent(value: number, digits = 2, opts: { sign?: boolean } = { sign: true }): string {
  if (!Number.isFinite(value)) return "–";
  return `${formatNumber(value, digits, opts)} %`;
}

export function formatPrice(value: number, currency: "USD" | "EUR"): string {
  if (!Number.isFinite(value)) return "–";
  const digits = value >= 10_000 ? 0 : 2;
  const num = formatNumber(value, digits);
  return currency === "USD" ? `${num} $` : `${num} €`;
}

export function currencySymbol(currency: "USD" | "EUR"): string {
  return currency === "USD" ? "$" : "€";
}

/** Kompakte Zahlen: 1,2 Tsd. / 3,4 Mio. / 5,6 Mrd. / 1,2 Bio. */
export function formatCompact(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "–";
  const abs = Math.abs(value);
  const units: [number, string][] = [
    [1e12, "Bio."],
    [1e9, "Mrd."],
    [1e6, "Mio."],
    [1e3, "Tsd."],
  ];
  for (const [factor, unit] of units) {
    if (abs >= factor) return `${formatNumber(value / factor, digits)} ${unit}`;
  }
  return formatNumber(value, 0);
}

/** Marktkapitalisierung aus Mrd.-Angabe. */
export function formatMarketCap(bn: number, currency: "USD" | "EUR"): string {
  return `${formatCompact(bn * 1e9)} ${currencySymbol(currency)}`;
}

export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return nf({ maximumFractionDigits: 0 }).format(Math.round(value));
}

const dtf = new Map<string, Intl.DateTimeFormat>();
function df(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = dtf.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, ...options });
    dtf.set(key, f);
  }
  return f;
}

/** „23.09.2026, 16:05“ */
export function formatDateTime(date: Date | string | number): string {
  return df({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(
    new Date(date),
  );
}

/** „23.09., 16:05“ */
export function formatShortDateTime(date: Date | string | number): string {
  return df({ day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

/** „23.09.2026“ */
export function formatDate(date: Date | string | number): string {
  return df({ day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(date));
}

/** „Mittwoch, 23. September“ */
export function formatLongDate(date: Date | string | number): string {
  return df({ weekday: "long", day: "numeric", month: "long" }).format(new Date(date));
}

/** „16:05“ */
export function formatTime(date: Date | string | number): string {
  return df({ hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

/** „16:05:12“ */
export function formatTimeSeconds(date: Date | string | number): string {
  return df({ hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(date));
}

/** „Stand: 23.09., 16:05“ */
export function formatStand(date: Date | string | number): string {
  return `Stand: ${formatShortDateTime(date)}`;
}

/** Relative Zeitangabe bezogen auf einen Referenzzeitpunkt (deterministisch). */
export function formatRelative(date: Date | string | number, reference: Date | string | number): string {
  const diffMs = new Date(reference).getTime() - new Date(date).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d === 1) return "gestern";
  if (d < 7) return `vor ${d} Tagen`;
  return formatDate(date);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
