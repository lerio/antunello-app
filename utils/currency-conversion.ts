/**
 * Currency conversion utilities using European Central Bank exchange rates via the
 * Frankfurter API (api.frankfurter.app).
 *
 * Provides functions for converting transaction amounts to EUR, fetching, caching,
 * and retrying exchange rates. Rates are stored in the local database to minimise
 * API calls and provide offline resilience. Includes exponential backoff retry logic
 * and fallback to the most recent available rate when a specific date's rate is
 * unavailable.
 *
 * @module utils/currency-conversion
 */

import { createClient } from '@/utils/supabase/client';
import { ExchangeRate } from '@/types/database';

/**
 * Result of a currency conversion operation.
 */
export interface CurrencyConversionResult {
  /** The amount converted to EUR (or original amount if already in EUR) */
  eurAmount: number;
  /** The exchange rate used for the conversion (1 EUR = X target currency) */
  exchangeRate: number;
  /** The date the exchange rate was sourced from */
  rateDate: string;
  /** Whether the rate was sourced from a fallback (e.g., most recent available) */
  isMissing: boolean;
}

/**
 * Raw response structure from the Frankfurter exchange rate API.
 */
export interface ExchangeRateResponse {
  /** Whether the API request was successful */
  success: boolean;
  /** The date of the exchange rates in the response */
  date: string;
  /** The base currency for the rates (always EUR) */
  base: string;
  /** A map of target currencies to their exchange rates */
  rates: Record<string, number>;
}

/**
 * Parse and validate exchange rate from API response.
 *
 * @param data - The raw API response object
 * @param targetCurrency - The target currency code to extract the rate for
 * @returns An object with the rate and missing flag, or null if the rate is not found
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
 * Handle retry with fallback on final attempt. On the last failed attempt,
 * tries to get the most recent available rate from the database as a fallback.
 * Otherwise applies exponential backoff delay before returning.
 *
 * @param attempt - Current attempt number (1-based)
 * @param retries - Total number of retries configured
 * @param targetCurrency - The target currency being looked up
 * @param date - The date for which the rate was requested
 * @returns The fallback rate if on the last attempt and a fallback exists,
 *          undefined to signal that retrying should continue, or null if no fallback found
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
 * Fetch exchange rates from ECB Frankfurter API (completely free, no API key required).
 *
 * Makes HTTP requests to api.frankfurter.app with configurable retries and
 * exponential backoff. On final failure, falls back to the most recent
 * cached rate from the database.
 *
 * @param date - The date for which to fetch exchange rates (YYYY-MM-DD)
 * @param targetCurrency - The target currency code (e.g. "USD", "JPY")
 * @param retries - Number of retry attempts on failure (default: 3)
 * @returns The exchange rate with a missing flag, or null if completely unavailable
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
 * Get the most recent exchange rate for a currency from our database.
 * Queries for the latest non-missing rate for the given target currency
 * against EUR, ordered by date descending.
 *
 * @param targetCurrency - The target currency code to look up
 * @returns The most recent ExchangeRate record, or null if none found
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
 * Store an exchange rate in the database. Uses upsert with a conflict on the
 * (date, base_currency, target_currency) composite key to avoid duplicates.
 *
 * @param date - The date of the exchange rate (YYYY-MM-DD)
 * @param targetCurrency - The target currency code
 * @param rate - The exchange rate value (1 EUR = X target currency)
 * @param isMissing - Whether this rate is a fallback/missing marker (default: false)
 * @returns The stored ExchangeRate record, or null on error
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
 * Get exchange rate from database or fetch from API if not available.
 *
 * Checks the local database first, and if no rate is cached for the given
 * date and currency, makes an API call to the Frankfurter service. EUR to EUR
 * conversions are handled inline without any external lookup.
 *
 * @param date - The date of the exchange rate (YYYY-MM-DD)
 * @param targetCurrency - The target currency code (e.g. "USD")
 * @returns A CurrencyConversionResult with rate and metadata, or null on complete failure
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
 * Convert an amount in a given currency to EUR.
 *
 * Uses the exchange rate for the specified date to divide the amount by the
 * rate (since rates are quoted as 1 EUR = X target currency). Returns the
 * EUR amount, exchange rate, and metadata. For EUR inputs, returns the
 * original amount with a rate of 1.
 *
 * @param amount - The amount to convert (in the source currency)
 * @param fromCurrency - The ISO 4217 currency code of the source amount
 * @param date - The transaction date for rate lookup (YYYY-MM-DD)
 * @returns The conversion result with EUR amount, or null if conversion failed
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
 * Batch convert multiple transactions to EUR with rate limiting and optimisation.
 *
 * Groups transactions by unique (date, currency) pairs to minimise API calls,
 * processes conversions in configurable batches with inter-batch delays to
 * avoid rate limiting, and assembles the results back in the original order.
 *
 * @param transactions - Array of objects containing amount, currency, and date
 * @param batchSize - Number of unique rate lookups to process concurrently (default: 20)
 * @param delayMs - Delay in milliseconds between batch requests (default: 200)
 * @returns Array of conversion results in the same order as the input, with null for failures
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

/**
 * Splits transactions into EUR (handled inline) and non-EUR (requires API lookup) groups.
 */
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

/**
 * Groups non-EUR transactions by their unique rate key (date-currency combination)
 * so that identical rate lookups are performed only once.
 */
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

/**
 * Fetches exchange rates for unique (date, currency) pairs in batches with delays.
 */
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

/**
 * Assembles the final conversion results array, applying the fetched rates
 * to all transactions that share the same (date, currency) key.
 */
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
      for (const idx of indices) {
        const originalAmount = transactions[idx].amount;
        finalResults[idx] = {
          eurAmount: Number((originalAmount / baseRate.exchangeRate).toFixed(2)),
          exchangeRate: baseRate.exchangeRate,
          rateDate: baseRate.rateDate,
          isMissing: baseRate.isMissing,
        };
      }
    } else {
      for (const idx of indices) {
        finalResults[idx] = null;
      }
    }
  }

  return finalResults;
}

/**
 * Get missing exchange rate dates for a currency.
 * Queries the database for rates that were previously marked as missing
 * (e.g., due to API failure or weekend data unavailability).
 *
 * @param targetCurrency - The target currency to check for missing rates
 * @returns Array of date strings (YYYY-MM-DD) for which rates are missing
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
 * Retry fetching missing exchange rates for a given currency.
 * Iterates over all previously marked-as-missing dates and attempts to
 * fetch the rate again from the API. Successful lookups are stored with
 * is_missing set to false.
 *
 * @param targetCurrency - The target currency to retry fetching rates for
 * @returns Summary of the retry operation with success, failed, and total counts
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
