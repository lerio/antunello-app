/**
 * Enable Banking API client.
 *
 * Provides a client class for interacting with the Enable Banking AIS (Account
 * Information Service) API. Handles JWT-based authentication using RS256-signed
 * tokens with the application's private key, supporting account listing and
 * transaction retrieval with optional date filtering.
 *
 * @module utils/enable-banking/client
 */

import * as jose from 'jose';

// Define the shape of the Enable Banking configuration
interface EnableBankingConfig {
  /** The private key (PEM format) for JWT signing */
  appKey: string;
  /** Key ID (often the same as App ID or a specific KID) */
  kid: string;
  /** Application ID for the Enable Banking API */
  appId: string;
}

// Define response types (simplified)
export interface EnableBankingTransaction {
  transaction_id?: string;
  /** Alternative ID field used by some banks */
  entry_reference?: string;
  /** Booking date in YYYY-MM-DD format — when the bank posted the transaction */
  booking_date: string;
  amount?: {
    currency: string;
    /** Amount as a string, e.g. "12.34" */
    amount: string;
  };
  /** Alternative amount field name used by some APIs */
  transaction_amount?: {
    currency: string;
    amount: string;
  };
  remittance_information_unstructured?: string;
  remittance_information_structured?: string;
  /** Array format used by some banks for remittance information */
  remittance_information?: string[];
  creditor?: { name: string };
  debtor?: { name: string };
  /** Credit/debit indicator: 'CRDT' for income, 'DBIT' for expense */
  credit_debit_indicator?: string;
  /** Debtor account IBAN (for expenses) */
  debtor_account?: { iban?: string };
  /** Creditor account IBAN (for income) */
  creditor_account?: { iban?: string };
  /**
   * Value date (YYYY-MM-DD) — when the money actually left/entered the account.
   * This is the most meaningful date for personal finance tracking.
   */
  value_date?: string;
  /** Transaction date (YYYY-MM-DD) — when the transaction was initiated */
  transaction_date?: string;
  /**
   * Transaction time (HH:mm:ss). Not part of the standard Enable Banking API
   * schema; observed from some bank-specific responses. When absent, the sync
   * service falls back to noon UTC so the date stays correct across timezones.
   */
  transaction_time?: string;
}

/** Integration configuration row from the integration_configs table. */
export interface IntegrationConfig {
  id: string;
  user_id: string;
  account_id: string;
  last_sync_at?: string | null;
  settings?: {
    fund_category_id?: string;
  } | null;
}

interface EnableBankingTransactionsResponse {
  transactions: EnableBankingTransaction[];
  continuation_key?: string;
}

interface EnableBankingAccount {
  uid: string;
  account_id: {
    iban: string;
    currency: string;
  };
  name?: string;
  provider?: string;
  /**
   * Stable hashes that identify the same real-world account across different
   * sessions/authorisations. Use these to re-match accounts after re-auth
   * when the account `uid` changes.
   */
  identification_hashes?: string[];
}

interface EnableBankingAccountsResponse {
  accounts: EnableBankingAccount[];
}

/**
 * Client for the Enable Banking AIS API.
 * Handles authentication via RS256 JWT tokens and provides methods for
 * fetching accounts and transactions.
 */
export class EnableBankingClient {
  private config: EnableBankingConfig;
  private baseUrl = 'https://api.enablebanking.com';

  /**
   * Creates a new Enable Banking API client.
   *
   * @param config - Configuration containing the app key, KID, and app ID
   */
  constructor(config: EnableBankingConfig) {
    this.config = config;
  }

  /**
   * Generates a short-lived (5 minute) RS256 JWT token for API authentication.
   * Signs the token with the configured private key and includes the KID in
   * the JWT header.
   *
   * @returns A promise resolving to the signed JWT string
   * @throws {Error} If the private key is invalid or signing fails
   */
  private async generateToken(): Promise<string> {
    const alg = 'RS256';
    const privateKey = await jose.importPKCS8(this.config.appKey, alg);

    const jwt = await new jose.SignJWT({})
      .setProtectedHeader({ alg, kid: this.config.kid })
      .setIssuedAt()
      .setExpirationTime('5m') // Short expiration for safety
      .setIssuer(this.config.appId)
      .setAudience('api.enablebanking.com')
      .sign(privateKey);

    return jwt;
  }

  /**
   * Fetches all bank accounts associated with the configured application.
   *
   * @returns A promise resolving to an array of bank accounts
   * @throws {Error} If the API request fails or returns a non-OK status
   */
  async getAccounts(): Promise<EnableBankingAccount[]> {
    const token = await this.generateToken();
    const response = await fetch(`${this.baseUrl}/accounts`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Enable Banking API Error: ${response.status} - ${errorText}`);
    }

    const data: EnableBankingAccountsResponse = await response.json();
    return data.accounts || [];
  }

  /**
   * Fetches transactions for a specific bank account, following pagination
   * via `continuation_key` until all pages are exhausted.
   *
   * Optionally filters by a start date using the `date_from` query parameter.
   *
   * @param accountId - The UID of the bank account to fetch transactions for
   * @param fromDate - Optional date to filter transactions from
   * @returns A promise resolving to an array of all transactions across all pages
   * @throws {Error} If any API request fails or returns a non-OK status
   */
  async getAccountTransactions(accountId: string, fromDate?: Date): Promise<EnableBankingTransaction[]> {
    const token = await this.generateToken();

    // Build the base URL with optional date filter
    const params = new URLSearchParams();
    if (fromDate) {
      params.set('date_from', fromDate.toISOString().split('T')[0]);
    }

    const allTransactions: EnableBankingTransaction[] = [];
    let continuationKey: string | undefined;

    do {
      // Append continuation_key to params if we have one from the previous page
      const pageParams = new URLSearchParams(params);
      if (continuationKey) {
        pageParams.set('continuation_key', continuationKey);
      }

      const url = `${this.baseUrl}/accounts/${accountId}/transactions?${pageParams.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Enable Banking API Error: ${response.status} - ${errorText}`);
      }

      const data: EnableBankingTransactionsResponse = await response.json();
      if (data.transactions) {
        allTransactions.push(...data.transactions);
      }

      continuationKey = data.continuation_key;
    } while (continuationKey);

    return allTransactions;
  }
}
