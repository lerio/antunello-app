import { createClient } from '@/utils/supabase/client';
import { ExchangeRate } from '@/types/database';

export interface CurrencyConversionResult {
  eurAmount: number;
  exchangeRate: number;
  rateDate: string;
  isMissing: boolean;
}

export interface ExchangeRateResponse {
  success: boolean;
  date: string;
  base: string;
  rates: Record<string, number>;
}

/**
 * Parse and validate exchange rate from API response
 */
async function parseExchangeRateResponse(data: any, targetCurrency: string): Promise<{ rate: number; isMissing: boolean } | null> {
  if (data.rates?.[targetCurrency]) {
    return {
      rate: data.rates[targetCurrency],
      isMissing: false
    };
  }
  return null;
}

/**
 * Handle retry with fallback on final attempt
 */
async function handleRetryFailure(attempt: number, retries: number, targetCurrency: string, date: string): Promise<{ rate: number; isMissing: boolean } | null | undefined> {
  if (attempt === retries) {
    // Last attempt failed, try to get the most recent available rate
    const fallbackRate = await getFallbackExchangeRate(targetCurrency);
    return fallbackRate
      ? { rate: fallbackRate.rate, isMissing: true }
      : null;
  }

  // Wait before retry (exponential backoff)
  const delay = Math.pow(2, attempt) * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
  return undefined; // Signal to continue retrying
}

/**
 * Fetch exchange rates from ECB API (completely free, no API key required)
 */
export async function fetchExchangeRateFromAPI(
  date: string,
  targetCurrency: string,
  retries: number = 3
): Promise<{ rate: number; isMissing: boolean } | null> {
  // Use European Central Bank API - completely free and official
  // Format: https://api.frankfurter.app/2025-06-30?from=EUR&to=JPY
  const baseURL = 'https://api.frankfurter.app';
  const url = `${baseURL}/${date}?from=EUR&to=${targetCurrency}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const result = await parseExchangeRateResponse(data, targetCurrency);

      if (result) {
        return result;
      }
      throw new Error(`No rate found for ${targetCurrency} on ${date}`);
    } catch (error) {
      console.warn(`Attempt ${attempt}/${retries} failed for ${date} ${targetCurrency}:`, error);

      const retryResult = await handleRetryFailure(attempt, retries, targetCurrency, date);
      if (retryResult !== undefined) {
        return retryResult;
      }
    }
  }

  return null;
}

/**
 * Get the most recent exchange rate for a currency from our database
 */
export async function getFallbackExchangeRate(targetCurrency: string): Promise<ExchangeRate | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('base_currency', 'EUR')
    .eq('target_currency', targetCurrency)
    .eq('is_missing', false)
    .order('date', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  return data[0];
}

/**
 * Store exchange rate in database
 */
export async function storeExchangeRate(
  date: string,
  targetCurrency: string,
  rate: number,
  isMissing: boolean = false
): Promise<ExchangeRate | null> {
  const supabase = createClient();

  const exchangeRateData = {
    date,
    base_currency: 'EUR',
    target_currency: targetCurrency,
    rate: Number(rate.toFixed(5)),
    source: 'frankfurter.app',
    is_missing: isMissing
  };

  const { data, error } = await supabase
    .from('exchange_rates')
    .upsert(exchangeRateData, { 
      onConflict: 'date,base_currency,target_currency',
      ignoreDuplicates: false 
    })
    .select()
    .single();

  if (error) {
    console.error('Error storing exchange rate:', error);
    return null;
  }

  return data;
}

/**
 * Get exchange rate from database or fetch if not available
 */
export async function getExchangeRate(
  date: string,
  targetCurrency: string
): Promise<CurrencyConversionResult | null> {
  if (targetCurrency === 'EUR') {
    return {
      eurAmount: 1,
      exchangeRate: 1,
      rateDate: date,
      isMissing: false
    };
  }

  const supabase = createClient();

  // First try to get from database
  const { data: existingRate, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('date', date)
    .eq('base_currency', 'EUR')
    .eq('target_currency', targetCurrency)
    .single();

  if (!error && existingRate) {
    return {
      eurAmount: 1,
      exchangeRate: existingRate.rate,
      rateDate: existingRate.date,
      isMissing: existingRate.is_missing || false
    };
  }

  // Not in database, fetch from API
  const apiResult = await fetchExchangeRateFromAPI(date, targetCurrency);
  
  if (!apiResult) {
    return null;
  }

  // Store in database
  await storeExchangeRate(date, targetCurrency, apiResult.rate, apiResult.isMissing);

  return {
    eurAmount: 1,
    exchangeRate: apiResult.rate,
    rateDate: date,
    isMissing: apiResult.isMissing
  };
}

/**
 * Convert amount to EUR
 */
export async function convertToEUR(
  amount: number,
  fromCurrency: string,
  date: string
): Promise<CurrencyConversionResult | null> {
  if (fromCurrency === 'EUR') {
    return {
      eurAmount: amount,
      exchangeRate: 1,
      rateDate: date,
      isMissing: false
    };
  }

  const conversionResult = await getExchangeRate(date, fromCurrency);
  
  if (!conversionResult) {
    return null;
  }

  return {
    eurAmount: Number((amount / conversionResult.exchangeRate).toFixed(2)),
    exchangeRate: conversionResult.exchangeRate,
    rateDate: conversionResult.rateDate,
    isMissing: conversionResult.isMissing
  };
}

/**
 * Batch convert multiple transactions to EUR with rate limiting and optimization
 */
export async function batchConvertToEUR(
  transactions: Array<{ amount: number; currency: string; date: string }>,
  batchSize: number = 20,
  delayMs: number = 200
): Promise<Array<CurrencyConversionResult | null>> {
  const { eurTransactions, nonEurTransactions } = splitTransactions(transactions);
  const uniqueRateKeys = groupByRateKey(nonEurTransactions);
  const rateResults = await fetchRatesForUniqueKeys(uniqueRateKeys, batchSize, delayMs);
  return assembleConversionResults(transactions, eurTransactions, uniqueRateKeys, rateResults);
}

// --- Helper functions to reduce cognitive complexity ---
function splitTransactions(
  transactions: Array<{ amount: number; currency: string; date: string }>
): {
  eurTransactions: Array<{ index: number; result: CurrencyConversionResult }>;
  nonEurTransactions: Array<{ index: number; transaction: { amount: number; currency: string; date: string } }>;
} {
  const eurTransactions: Array<{ index: number; result: CurrencyConversionResult }> = [];
  const nonEurTransactions: Array<{ index: number; transaction: { amount: number; currency: string; date: string } }> = [];

  for (let index = 0; index < transactions.length; index++) {
    const transaction = transactions[index];
    if (transaction.currency === 'EUR') {
      eurTransactions.push({
        index,
        result: {
          eurAmount: transaction.amount,
          exchangeRate: 1,
          rateDate: transaction.date,
          isMissing: false,
        },
      });
    } else {
      nonEurTransactions.push({ index, transaction });
    }
  }
  return { eurTransactions, nonEurTransactions };
}

function groupByRateKey(
  nonEurTransactions: Array<{ index: number; transaction: { amount: number; currency: string; date: string } }>
): Map<string, { indices: number[]; transaction: { amount: number; currency: string; date: string } }> {
  const uniqueRateKeys = new Map<string, { indices: number[]; transaction: { amount: number; currency: string; date: string } }>();
  for (const { index, transaction } of nonEurTransactions) {
    const rateKey = `${transaction.date}-${transaction.currency}`;
    const existing = uniqueRateKeys.get(rateKey);
    if (existing) {
      existing.indices.push(index);
    } else {
      uniqueRateKeys.set(rateKey, { indices: [index], transaction });
    }
  }
  return uniqueRateKeys;
}

async function fetchRatesForUniqueKeys(
  uniqueRateKeys: Map<string, { indices: number[]; transaction: { amount: number; currency: string; date: string } }>,
  batchSize: number,
  delayMs: number
): Promise<Map<string, CurrencyConversionResult | null>> {
  const uniqueRateEntries = Array.from(uniqueRateKeys.entries());
  const rateResults = new Map<string, CurrencyConversionResult | null>();

  for (let i = 0; i < uniqueRateEntries.length; i += batchSize) {
    const batch = uniqueRateEntries.slice(i, i + batchSize);

    const batchPromises = batch.map(async ([rateKey, { transaction }], index) => {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const exchangeRate = await getExchangeRate(transaction.date, transaction.currency);
      if (exchangeRate) {
        return {
          rateKey,
          result: {
            eurAmount: Number((transaction.amount / exchangeRate.exchangeRate).toFixed(2)),
            exchangeRate: exchangeRate.exchangeRate,
            rateDate: exchangeRate.rateDate,
            isMissing: exchangeRate.isMissing,
          },
        };
      }
      return { rateKey, result: null };
    });

    const batchResults = await Promise.all(batchPromises);
    for (const { rateKey, result } of batchResults) {
      rateResults.set(rateKey, result);
    }

    if (i + batchSize < uniqueRateEntries.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return rateResults;
}

function assembleConversionResults(
  transactions: Array<{ amount: number; currency: string; date: string }>,
  eurTransactions: Array<{ index: number; result: CurrencyConversionResult }>,
  uniqueRateKeys: Map<string, { indices: number[]; transaction: { amount: number; currency: string; date: string } }>,
  rateResults: Map<string, CurrencyConversionResult | null>
): Array<CurrencyConversionResult | null> {
  const finalResults: Array<CurrencyConversionResult | null> = Array.from({ length: transactions.length }, () => null);

  for (const { index, result } of eurTransactions) {
    finalResults[index] = result;
  }

  for (const [rateKey, group] of Array.from(uniqueRateKeys.entries())) {
    const baseRate = rateResults.get(rateKey);
    const indices = group.indices;
    if (baseRate) {
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        const originalAmount = transactions[idx].amount;
        finalResults[idx] = {
          eurAmount: Number((originalAmount / baseRate.exchangeRate).toFixed(2)),
          exchangeRate: baseRate.exchangeRate,
          rateDate: baseRate.rateDate,
          isMissing: baseRate.isMissing,
        };
      }
    } else {
      for (let i = 0; i < indices.length; i++) {
        finalResults[indices[i]] = null;
      }
    }
  }

  return finalResults;
}

/**
 * Get missing exchange rate dates for a currency
 */
export async function getMissingExchangeRateDates(targetCurrency: string): Promise<string[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('date')
    .eq('base_currency', 'EUR')
    .eq('target_currency', targetCurrency)
    .eq('is_missing', true)
    .order('date', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(item => item.date);
}

/**
 * Retry fetching missing exchange rates
 */
export async function retryMissingExchangeRates(targetCurrency: string): Promise<{
  success: number;
  failed: number;
  total: number;
}> {
  const missingDates = await getMissingExchangeRateDates(targetCurrency);
  
  let success = 0;
  let failed = 0;

  for (const date of missingDates) {
    const apiResult = await fetchExchangeRateFromAPI(date, targetCurrency, 1);
    
    if (apiResult && !apiResult.isMissing) {
      await storeExchangeRate(date, targetCurrency, apiResult.rate, false);
      success++;
    } else {
      failed++;
    }
  }

  return {
    success,
    failed,
    total: missingDates.length
  };
}