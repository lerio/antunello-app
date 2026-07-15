/**
 * Trade Republic type definitions.
 *
 * Types for the TR API responses and the session data stored in
 * integration_configs.settings. TR has no official API — these types
 * are based on the reverse-engineered endpoints used by pytr and
 * other community projects.
 *
 * @module utils/trade-republic/types
 */

/** A single transaction from the Trade Republic API. */
export interface TRTransaction {
  id: string;
  /** Amount in the account's currency. Negative = debit, positive = credit. */
  amount: number;
  /** ISO 4217 currency code (e.g. "EUR"). */
  currency: string;
  /** ISO 8601 timestamp of the transaction. */
  date: string;
  /** Human-readable description. */
  title: string;
  /** Transaction category from TR. */
  type: TRTransactionType;
  /** Optional ISIN for securities-related transactions. */
  isin?: string;
  /** Optional instrument name (stock, ETF, etc.). */
  instrumentName?: string;
  /** Number of shares for buy/sell transactions. */
  shares?: number;
  /** Price per share. */
  pricePerShare?: number;
}

/** Trade Republic transaction categories. */
export type TRTransactionType =
  | 'CARD_PAYMENT'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'INTEREST'
  | 'SAVINGS_PLAN'
  | 'FEE'
  | 'TAX_REFUND'
  | 'OTHER';

/** Session data stored in integration_configs.settings for TR integrations. */
export interface TRSettings {
  /** Serialised cookie jar string for TR API authentication. */
  session_cookies: string;
  /** Phone number used for login (stored for display in the UI). */
  phone_number: string;
  /** ISO timestamp when the session is expected to expire. */
  session_expires_at: string;
  /** Current authentication state. */
  auth_status: 'authenticated' | 'session_expired' | 'needs_setup';
  /** Optional fund category ID mapping (same as Enable Banking). */
  fund_category_id?: string | null;
  /** Whether this account participates in bulk fetch. */
  bulk_fetch_enabled?: boolean;
}

/**
 * The payload shape received by the TR auth API route from the
 * 2-step client-side form.
 */
export interface TRAuthPayload {
  step: 1 | 2;
  phoneNumber?: string;
  pin?: string;
  processId?: string;
  code?: string;
}
