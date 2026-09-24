import type { RatesProvider } from './investment.repo-port.js';

/** BCB SGS: 4391 CDI acum. mês %, 4189 Selic acum. mês %, 433 IPCA mensal %. */
const SERIES = { cdi: 4391, selic: 4189, ipca: 433 } as const;

function monthBounds(monthId: string): { start: string; end: string } {
  const [y, m] = monthId.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `01/${pad(m)}/${y}`,
    end: `${pad(lastDay)}/${pad(m)}/${y}`,
  };
}

async function fetchSeriesPercent(seriesId: number, monthId: string): Promise<number | null> {
  const { start, end } = monthBounds(monthId);
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados` +
    `?formato=json&dataInicial=${encodeURIComponent(start)}&dataFinal=${encodeURIComponent(end)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok || !Array.isArray(json) || json.length === 0) return null;
  const last = json[json.length - 1] as { valor?: string };
  const raw = String(last?.valor ?? '').replace(',', '.');
  const pct = parseFloat(raw);
  if (!Number.isFinite(pct)) return null;
  return pct / 100;
}

/** Public BCB SGS — no secret required. */
export class BcbRatesProvider implements RatesProvider {
  async fetchMonthRates(monthId: string) {
    const [cdi, selic, ipca] = await Promise.all([
      fetchSeriesPercent(SERIES.cdi, monthId),
      fetchSeriesPercent(SERIES.selic, monthId),
      fetchSeriesPercent(SERIES.ipca, monthId),
    ]);
    return { monthId, cdi, selic, ipca };
  }
}
