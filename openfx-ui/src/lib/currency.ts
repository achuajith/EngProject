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

// Convert using a rates object that contains USD, CAD, EUR with USD as base (USD = 1)
export function convertCurrency(amount: number, from: string, to: string, rates: { USD: number; CAD: number; EUR: number }) {
  if (!(from in rates) || !(to in rates)) throw new Error('Currency not supported');
  // Since USD is base, if from is USD -> multiply by target
  if (from === 'USD') return amount * rates[to as keyof typeof rates];
  // Convert from source to USD first
  const amountInUsd = amount / rates[from as keyof typeof rates];
  // Then USD to target
  return amountInUsd * rates[to as keyof typeof rates];
}

// Helper to format a number in target currency using Intl.
export function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return amount.toFixed(2) + ' ' + currency;
  }
}

// High-level convenience: given raw API response and desired display currency, return formatted amount
export function convertAndFormat(amount: number, from: string, to: string, resp: OpenExchangeRatesResponse) {
  const core = extractCoreRates(resp);
  const converted = convertCurrency(amount, from, to, core);
  return formatCurrency(converted, to);
}
