// Currency conversion utilities for OpenExchangeRates

export type OpenExchangeRatesResponse = {
  disclaimer: string;
  license: string;
  timestamp: number;
  base: string; // should be 'USD'
  rates: Record<string, number>;
};

export async function fetchExchangeRates(apiKey: string): Promise<OpenExchangeRatesResponse> {
  const url = `https://openexchangerates.org/api/latest.json?app_id=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch exchange rates");
  const data = await res.json();
  return data as OpenExchangeRatesResponse;
}

// Extract only the three rates we care about (USD base, CAD, EUR)
export function extractCoreRates(resp: OpenExchangeRatesResponse) {
  const { rates } = resp;
  const usd = rates['USD'] ?? 1; // base
  const cad = rates['CAD'];
  const eur = rates['EUR'];
  if (!cad || !eur) throw new Error('CAD or EUR rate missing in response');
  return { USD: usd, CAD: cad, EUR: eur };
}
