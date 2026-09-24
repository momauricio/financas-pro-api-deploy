import type { MarketQuote, QuotesProvider } from './investment.repo-port.js';

type Market = 'B3' | 'US';

async function quoteFromYahoo(ticker: string, market: Market): Promise<MarketQuote> {
  const symbol = market === 'US' ? ticker : `${ticker}.SA`;
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=1d&range=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; FinancasPro/1.0)',
      },
    });
    const json = (await res.json().catch(() => ({}))) as {
      chart?: { result?: { meta?: Record<string, unknown> }[] };
    };
    if (!res.ok) {
      return { symbol: ticker, price: null, market, error: `Yahoo HTTP ${res.status}` };
    }
    const meta = json?.chart?.result?.[0]?.meta;
    const price = Number(meta?.regularMarketPrice ?? meta?.previousClose);
    if (!Number.isFinite(price) || !(price > 0)) {
      return { symbol: ticker, price: null, market, error: 'Preço indisponível (Yahoo)' };
    }
    return { symbol: ticker, price, market };
  } catch (e) {
    return {
      symbol: ticker,
      price: null,
      market,
      error: e instanceof Error ? e.message : 'Falha Yahoo',
    };
  }
}

async function quotesFromBrapi(
  tickers: string[],
  token: string,
): Promise<{ results: Record<string, unknown>[]; error?: string }> {
  const symbols = tickers.join(',');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const v2Url = `https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(symbols)}`;
  const v2Res = await fetch(v2Url, { headers });
  const v2Json = (await v2Res.json().catch(() => ({}))) as {
    results?: Record<string, unknown>[];
    message?: string;
    error?: string;
  };
  if (v2Res.ok && Array.isArray(v2Json?.results)) {
    return { results: v2Json.results };
  }
  const legacyUrl = `https://brapi.dev/api/quote/${encodeURIComponent(symbols)}`;
  const legacyRes = await fetch(legacyUrl, { headers });
  const legacyJson = (await legacyRes.json().catch(() => ({}))) as {
    results?: Record<string, unknown>[];
    message?: string;
    error?: string;
  };
  if (!legacyRes.ok) {
    return {
      results: [],
      error:
        legacyJson?.message ||
        v2Json?.message ||
        legacyJson?.error ||
        v2Json?.error ||
        `brapi HTTP ${legacyRes.status}`,
    };
  }
  return {
    results: Array.isArray(legacyJson?.results) ? legacyJson.results : [],
  };
}

/**
 * Market quotes — BRAPI_TOKEN stays server-side (never in Vite).
 * Falls back to Yahoo for US and when BRAPI is unset/fails for B3.
 */
export class MarketQuotesProvider implements QuotesProvider {
  constructor(private readonly brapiToken: string | undefined = process.env.BRAPI_TOKEN) {}

  async fetchQuotes(
    requests: { symbol: string; market: 'B3' | 'US' }[],
  ): Promise<MarketQuote[]> {
    const unique = [
      ...new Map(requests.map((q) => [`${q.market}:${q.symbol.toUpperCase()}`, q] as const)).values(),
    ];
    if (unique.length === 0) return [];

    const b3 = unique.filter((q) => q.market === 'B3');
    const us = unique.filter((q) => q.market === 'US');
    const out: MarketQuote[] = [];

    if (b3.length > 0 && this.brapiToken) {
      const { results, error } = await quotesFromBrapi(
        b3.map((q) => q.symbol.toUpperCase()),
        this.brapiToken,
      );
      const bySymbol = new Map(
        results.map((r) => [String(r.symbol || r.ticker || '').toUpperCase(), r]),
      );
      for (const q of b3) {
        const row = bySymbol.get(q.symbol.toUpperCase());
        const price = Number(row?.regularMarketPrice ?? row?.price ?? row?.close);
        if (Number.isFinite(price) && price > 0) {
          out.push({ symbol: q.symbol.toUpperCase(), price, market: 'B3' });
        } else {
          out.push(await quoteFromYahoo(q.symbol.toUpperCase(), 'B3'));
          if (error && !out[out.length - 1]?.price) {
            out[out.length - 1] = {
              symbol: q.symbol.toUpperCase(),
              price: null,
              market: 'B3',
              error,
            };
          }
        }
      }
    } else {
      for (const q of b3) {
        out.push(await quoteFromYahoo(q.symbol.toUpperCase(), 'B3'));
      }
    }

    for (const q of us) {
      out.push(await quoteFromYahoo(q.symbol.toUpperCase(), 'US'));
    }

    return out;
  }
}
