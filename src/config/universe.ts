/**
 * Anlage-Universum von Signal: ~150 US-Large-Caps + DAX 40.
 *
 * Einzige Quelle der Wahrheit für Symbole, Namen, Sektoren und Größenordnungen.
 * Marktkapitalisierungen sind gerundete Näherungen (Mrd., Heimatwährung) und dienen
 * als Fallback für die Heatmap-Kachelgröße und die Mock-Daten. Echte Provider
 * überschreiben sie, sofern verfügbar. Die DAX-Zusammensetzung ändert sich
 * quartalsweise – bitte bei Bedarf hier anpassen.
 */
import type { SectorId } from "./sectors";

export type Region = "US" | "DE";
export type Exchange = "NASDAQ" | "NYSE" | "XETRA";
export type Currency = "USD" | "EUR";

export interface Instrument {
  /** App-weites Symbol. US: Ticker („AAPL“), Deutschland: Ticker + „.DE“ („SAP.DE“). */
  symbol: string;
  /** Kurzform für Anzeige und Cashtags („SAP“). */
  ticker: string;
  name: string;
  region: Region;
  exchange: Exchange;
  currency: Currency;
  sector: SectorId;
  /** Marktkapitalisierung in Mrd. Heimatwährung (Näherung). */
  marketCapBn: number;
  /** Alternative Namen für Suche und Social-Matching. */
  aliases: string[];
}

/** EUR→USD für die Vergleichbarkeit der Kachelgrößen (bewusst statisch). */
export const EUR_USD = 1.17;

type Row = [ticker: string, name: string, sector: SectorId, capBn: number, exchange: Exchange, aliases?: string[]];

const US: Row[] = [
  // Technologie
  ["AAPL", "Apple", "tech", 3400, "NASDAQ", ["iPhone"]],
  ["MSFT", "Microsoft", "tech", 3700, "NASDAQ"],
  ["NVDA", "Nvidia", "tech", 4200, "NASDAQ"],
  ["AVGO", "Broadcom", "tech", 1500, "NASDAQ"],
  ["ORCL", "Oracle", "tech", 700, "NYSE"],
  ["CRM", "Salesforce", "tech", 250, "NYSE"],
  ["ADBE", "Adobe", "tech", 160, "NASDAQ"],
  ["AMD", "Advanced Micro Devices", "tech", 260, "NASDAQ", ["AMD"]],
  ["CSCO", "Cisco Systems", "tech", 270, "NASDAQ"],
  ["ACN", "Accenture", "tech", 170, "NYSE"],
  ["IBM", "IBM", "tech", 250, "NYSE"],
  ["INTU", "Intuit", "tech", 190, "NASDAQ"],
  ["QCOM", "Qualcomm", "tech", 180, "NASDAQ"],
  ["TXN", "Texas Instruments", "tech", 170, "NASDAQ"],
  ["AMAT", "Applied Materials", "tech", 150, "NASDAQ"],
  ["NOW", "ServiceNow", "tech", 200, "NYSE"],
  ["MU", "Micron Technology", "tech", 140, "NASDAQ"],
  ["LRCX", "Lam Research", "tech", 130, "NASDAQ"],
  ["KLAC", "KLA", "tech", 110, "NASDAQ"],
  ["ADI", "Analog Devices", "tech", 115, "NASDAQ"],
  ["PANW", "Palo Alto Networks", "tech", 130, "NASDAQ"],
  ["SNPS", "Synopsys", "tech", 80, "NASDAQ"],
  ["CDNS", "Cadence Design", "tech", 90, "NASDAQ"],
  ["ANET", "Arista Networks", "tech", 170, "NYSE"],
  ["INTC", "Intel", "tech", 100, "NASDAQ"],
  ["PLTR", "Palantir", "tech", 400, "NASDAQ"],
  ["CRWD", "CrowdStrike", "tech", 120, "NASDAQ"],
  ["MRVL", "Marvell Technology", "tech", 60, "NASDAQ"],
  ["APH", "Amphenol", "tech", 140, "NYSE"],
  ["SMCI", "Super Micro Computer", "tech", 25, "NASDAQ", ["Supermicro"]],
  // Kommunikation
  ["GOOGL", "Alphabet", "communication", 2500, "NASDAQ", ["Google", "YouTube"]],
  ["META", "Meta Platforms", "communication", 1800, "NASDAQ", ["Facebook", "Instagram"]],
  ["NFLX", "Netflix", "communication", 520, "NASDAQ"],
  ["DIS", "Walt Disney", "communication", 205, "NYSE", ["Disney"]],
  ["TMUS", "T-Mobile US", "communication", 270, "NASDAQ"],
  ["VZ", "Verizon", "communication", 180, "NYSE"],
  ["T", "AT&T", "communication", 200, "NYSE"],
  ["CMCSA", "Comcast", "communication", 130, "NASDAQ"],
  ["EA", "Electronic Arts", "communication", 45, "NASDAQ"],
  ["TTWO", "Take-Two Interactive", "communication", 42, "NASDAQ", ["GTA"]],
  ["RDDT", "Reddit", "communication", 40, "NYSE"],
  ["SNAP", "Snap", "communication", 14, "NYSE", ["Snapchat"]],
  ["PINS", "Pinterest", "communication", 22, "NYSE"],
  // Zyklischer Konsum
  ["AMZN", "Amazon", "consumer-discretionary", 2400, "NASDAQ", ["AWS"]],
  ["TSLA", "Tesla", "consumer-discretionary", 1100, "NASDAQ"],
  ["HD", "Home Depot", "consumer-discretionary", 390, "NYSE"],
  ["MCD", "McDonald's", "consumer-discretionary", 220, "NYSE", ["McDonalds"]],
  ["NKE", "Nike", "consumer-discretionary", 100, "NYSE"],
  ["SBUX", "Starbucks", "consumer-discretionary", 100, "NASDAQ"],
  ["LOW", "Lowe's", "consumer-discretionary", 140, "NYSE"],
  ["BKNG", "Booking Holdings", "consumer-discretionary", 170, "NASDAQ", ["Booking.com"]],
  ["TJX", "TJX Companies", "consumer-discretionary", 150, "NYSE"],
  ["CMG", "Chipotle", "consumer-discretionary", 60, "NYSE"],
  ["ABNB", "Airbnb", "consumer-discretionary", 80, "NASDAQ"],
  ["GM", "General Motors", "consumer-discretionary", 55, "NYSE"],
  ["F", "Ford Motor", "consumer-discretionary", 43, "NYSE", ["Ford"]],
  ["ORLY", "O'Reilly Automotive", "consumer-discretionary", 80, "NASDAQ"],
  ["LULU", "Lululemon", "consumer-discretionary", 25, "NASDAQ"],
  ["RIVN", "Rivian", "consumer-discretionary", 15, "NASDAQ"],
  ["DASH", "DoorDash", "consumer-discretionary", 100, "NASDAQ"],
  ["GME", "GameStop", "consumer-discretionary", 10, "NYSE"],
  // Basiskonsum
  ["WMT", "Walmart", "consumer-staples", 800, "NYSE"],
  ["PG", "Procter & Gamble", "consumer-staples", 370, "NYSE"],
  ["KO", "Coca-Cola", "consumer-staples", 300, "NYSE", ["Coke"]],
  ["PEP", "PepsiCo", "consumer-staples", 200, "NASDAQ", ["Pepsi"]],
  ["COST", "Costco", "consumer-staples", 420, "NASDAQ"],
  ["PM", "Philip Morris", "consumer-staples", 260, "NYSE"],
  ["MO", "Altria", "consumer-staples", 100, "NYSE"],
  ["MDLZ", "Mondelez", "consumer-staples", 85, "NASDAQ"],
  ["CL", "Colgate-Palmolive", "consumer-staples", 70, "NYSE"],
  ["TGT", "Target", "consumer-staples", 45, "NYSE"],
  ["KR", "Kroger", "consumer-staples", 45, "NYSE"],
  ["MNST", "Monster Beverage", "consumer-staples", 55, "NASDAQ"],
  // Gesundheit
  ["LLY", "Eli Lilly", "health", 700, "NYSE", ["Lilly"]],
  ["UNH", "UnitedHealth", "health", 300, "NYSE"],
  ["JNJ", "Johnson & Johnson", "health", 420, "NYSE"],
  ["ABBV", "AbbVie", "health", 360, "NYSE"],
  ["MRK", "Merck & Co.", "health", 210, "NYSE"],
  ["PFE", "Pfizer", "health", 140, "NYSE"],
  ["TMO", "Thermo Fisher", "health", 180, "NYSE"],
  ["ABT", "Abbott", "health", 230, "NYSE"],
  ["DHR", "Danaher", "health", 140, "NYSE"],
  ["AMGN", "Amgen", "health", 150, "NASDAQ"],
  ["ISRG", "Intuitive Surgical", "health", 180, "NASDAQ"],
  ["BMY", "Bristol-Myers Squibb", "health", 95, "NYSE"],
  ["GILD", "Gilead Sciences", "health", 140, "NASDAQ"],
  ["CVS", "CVS Health", "health", 90, "NYSE"],
  ["VRTX", "Vertex Pharmaceuticals", "health", 110, "NASDAQ"],
  ["SYK", "Stryker", "health", 150, "NYSE"],
  ["BSX", "Boston Scientific", "health", 150, "NYSE"],
  ["MRNA", "Moderna", "health", 10, "NASDAQ"],
  // Finanzen
  ["BRK.B", "Berkshire Hathaway", "financials", 1050, "NYSE", ["Berkshire", "Buffett"]],
  ["JPM", "JPMorgan Chase", "financials", 800, "NYSE", ["JP Morgan"]],
  ["V", "Visa", "financials", 680, "NYSE"],
  ["MA", "Mastercard", "financials", 530, "NYSE"],
  ["BAC", "Bank of America", "financials", 370, "NYSE"],
  ["WFC", "Wells Fargo", "financials", 260, "NYSE"],
  ["GS", "Goldman Sachs", "financials", 220, "NYSE"],
  ["MS", "Morgan Stanley", "financials", 230, "NYSE"],
  ["AXP", "American Express", "financials", 210, "NYSE", ["Amex"]],
  ["C", "Citigroup", "financials", 180, "NYSE", ["Citi"]],
  ["SCHW", "Charles Schwab", "financials", 170, "NYSE"],
  ["BLK", "BlackRock", "financials", 170, "NYSE"],
  ["SPGI", "S&P Global", "financials", 160, "NYSE"],
  ["PGR", "Progressive", "financials", 150, "NYSE"],
  ["PYPL", "PayPal", "financials", 65, "NASDAQ"],
  ["COF", "Capital One", "financials", 140, "NYSE"],
  ["CME", "CME Group", "financials", 100, "NASDAQ"],
  ["COIN", "Coinbase", "financials", 90, "NASDAQ"],
  ["HOOD", "Robinhood", "financials", 100, "NASDAQ"],
  ["SOFI", "SoFi Technologies", "financials", 30, "NASDAQ", ["SoFi"]],
  // Industrie
  ["GE", "GE Aerospace", "industrials", 290, "NYSE", ["General Electric"]],
  ["CAT", "Caterpillar", "industrials", 200, "NYSE"],
  ["RTX", "RTX", "industrials", 210, "NYSE", ["Raytheon"]],
  ["HON", "Honeywell", "industrials", 135, "NASDAQ"],
  ["UNP", "Union Pacific", "industrials", 135, "NYSE"],
  ["BA", "Boeing", "industrials", 160, "NYSE"],
  ["UPS", "United Parcel Service", "industrials", 72, "NYSE", ["UPS"]],
  ["DE", "Deere & Company", "industrials", 130, "NYSE", ["John Deere"]],
  ["LMT", "Lockheed Martin", "industrials", 110, "NYSE"],
  ["ETN", "Eaton", "industrials", 140, "NYSE"],
  ["ADP", "Automatic Data Processing", "industrials", 120, "NASDAQ"],
  ["WM", "Waste Management", "industrials", 90, "NYSE"],
  ["FDX", "FedEx", "industrials", 55, "NYSE"],
  ["UAL", "United Airlines", "industrials", 30, "NASDAQ"],
  ["DAL", "Delta Air Lines", "industrials", 38, "NYSE"],
  // Energie
  ["XOM", "Exxon Mobil", "energy", 480, "NYSE", ["Exxon"]],
  ["CVX", "Chevron", "energy", 300, "NYSE"],
  ["COP", "ConocoPhillips", "energy", 115, "NYSE"],
  ["EOG", "EOG Resources", "energy", 65, "NYSE"],
  ["SLB", "SLB", "energy", 50, "NYSE", ["Schlumberger"]],
  ["OXY", "Occidental Petroleum", "energy", 42, "NYSE"],
  ["MPC", "Marathon Petroleum", "energy", 55, "NYSE"],
  // Grundstoffe
  ["LIN", "Linde", "materials", 220, "NASDAQ"],
  ["SHW", "Sherwin-Williams", "materials", 85, "NYSE"],
  ["FCX", "Freeport-McMoRan", "materials", 65, "NYSE"],
  ["NEM", "Newmont", "materials", 90, "NYSE"],
  ["ECL", "Ecolab", "materials", 72, "NYSE"],
  // Versorger
  ["NEE", "NextEra Energy", "utilities", 150, "NYSE"],
  ["SO", "Southern Company", "utilities", 100, "NYSE"],
  ["DUK", "Duke Energy", "utilities", 95, "NYSE"],
  ["CEG", "Constellation Energy", "utilities", 100, "NASDAQ"],
  ["VST", "Vistra", "utilities", 65, "NYSE"],
  // Immobilien
  ["PLD", "Prologis", "real-estate", 105, "NYSE"],
  ["AMT", "American Tower", "real-estate", 95, "NYSE"],
  ["EQIX", "Equinix", "real-estate", 75, "NASDAQ"],
  ["SPG", "Simon Property Group", "real-estate", 58, "NYSE"],
  ["O", "Realty Income", "real-estate", 52, "NYSE"],
];

const DAX: Row[] = [
  ["SAP", "SAP", "tech", 280, "XETRA"],
  ["SIE", "Siemens", "industrials", 180, "XETRA"],
  ["DTE", "Deutsche Telekom", "communication", 150, "XETRA", ["Telekom"]],
  ["AIR", "Airbus", "industrials", 150, "XETRA"],
  ["ALV", "Allianz", "financials", 140, "XETRA"],
  ["RHM", "Rheinmetall", "industrials", 80, "XETRA"],
  ["ENR", "Siemens Energy", "industrials", 80, "XETRA"],
  ["MUV2", "Münchener Rück", "financials", 75, "XETRA", ["Munich Re", "Muenchener Rueck"]],
  ["MBG", "Mercedes-Benz Group", "consumer-discretionary", 55, "XETRA", ["Mercedes", "Daimler"]],
  ["DBK", "Deutsche Bank", "financials", 55, "XETRA"],
  ["SHL", "Siemens Healthineers", "health", 55, "XETRA", ["Healthineers"]],
  ["MRK", "Merck KGaA", "health", 55, "XETRA", ["Merck Darmstadt"]],
  ["BMW", "BMW", "consumer-discretionary", 50, "XETRA"],
  ["VOW3", "Volkswagen Vz.", "consumer-discretionary", 50, "XETRA", ["VW", "Volkswagen"]],
  ["DB1", "Deutsche Börse", "financials", 45, "XETRA", ["Deutsche Boerse"]],
  ["IFX", "Infineon", "tech", 45, "XETRA"],
  ["DHL", "DHL Group", "industrials", 45, "XETRA", ["Deutsche Post"]],
  ["BAS", "BASF", "materials", 40, "XETRA"],
  ["EOAN", "E.ON", "utilities", 40, "XETRA", ["EON"]],
  ["ADS", "Adidas", "consumer-discretionary", 35, "XETRA"],
  ["CBK", "Commerzbank", "financials", 35, "XETRA", ["Coba"]],
  ["HNR1", "Hannover Rück", "financials", 33, "XETRA", ["Hannover Re"]],
  ["HEI", "Heidelberg Materials", "materials", 30, "XETRA", ["HeidelbergCement"]],
  ["DTG", "Daimler Truck", "industrials", 30, "XETRA"],
  ["HEN3", "Henkel Vz.", "consumer-staples", 30, "XETRA", ["Henkel"]],
  ["BAYN", "Bayer", "health", 28, "XETRA"],
  ["RWE", "RWE", "utilities", 25, "XETRA"],
  ["BEI", "Beiersdorf", "consumer-staples", 25, "XETRA", ["Nivea"]],
  ["VNA", "Vonovia", "real-estate", 23, "XETRA"],
  ["FRE", "Fresenius", "health", 22, "XETRA"],
  ["MTX", "MTU Aero Engines", "industrials", 18, "XETRA", ["MTU"]],
  ["SY1", "Symrise", "materials", 14, "XETRA"],
  ["SRT3", "Sartorius Vz.", "health", 14, "XETRA", ["Sartorius"]],
  ["CON", "Continental", "consumer-discretionary", 13, "XETRA"],
  ["FME", "Fresenius Medical Care", "health", 13, "XETRA", ["FMC"]],
  ["G1A", "GEA Group", "industrials", 10, "XETRA", ["GEA"]],
  ["QIA", "Qiagen", "health", 9, "XETRA"],
  ["BNR", "Brenntag", "industrials", 8, "XETRA"],
  ["ZAL", "Zalando", "consumer-discretionary", 7, "XETRA"],
  ["G24", "Scout24", "communication", 7, "XETRA", ["ImmoScout24"]],
];

function toInstrument([ticker, name, sector, capBn, exchange, aliases = []]: Row): Instrument {
  const de = exchange === "XETRA";
  return {
    symbol: de ? `${ticker}.DE` : ticker,
    ticker,
    name,
    region: de ? "DE" : "US",
    exchange,
    currency: de ? "EUR" : "USD",
    sector,
    marketCapBn: capBn,
    aliases,
  };
}

export const UNIVERSE: readonly Instrument[] = [...US, ...DAX].map(toInstrument);

const bySymbol = new Map(UNIVERSE.map((i) => [i.symbol.toUpperCase(), i]));

export function getInstrument(symbol: string): Instrument | undefined {
  return bySymbol.get(decodeURIComponent(symbol).toUpperCase());
}

/** Marktkapitalisierung in Mrd. USD für den Größenvergleich. */
export function marketCapUsdBn(instrument: Pick<Instrument, "currency">, capBn: number): number {
  return instrument.currency === "EUR" ? capBn * EUR_USD : capBn;
}

export interface IndexDef {
  id: "SPX" | "NDX" | "DAX";
  name: string;
  currency: Currency;
  region: Region;
  /** Handelbarer Proxy (ETF), falls der Provider keine Indexkurse liefert. */
  proxy: string;
}

export const INDICES: readonly IndexDef[] = [
  { id: "SPX", name: "S&P 500", currency: "USD", region: "US", proxy: "SPY" },
  { id: "NDX", name: "Nasdaq 100", currency: "USD", region: "US", proxy: "QQQ" },
  { id: "DAX", name: "DAX", currency: "EUR", region: "DE", proxy: "EXS1.DE" },
];
