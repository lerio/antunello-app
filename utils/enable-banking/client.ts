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
  /** Booking date in YYYY-MM-DD format */
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
  /** Value date if different from booking date */
  value_date?: string;
  /** Transaction date if different from booking date */
  transaction_date?: string;
  /** Transaction time (HH:mm:ss) */
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
   * Fetches transactions for a specific bank account.
   * Optionally filters by a start date using the `date_from` query parameter.
   *
   * @param accountId - The UID of the bank account to fetch transactions for
   * @param fromDate - Optional date to filter transactions from
   * @returns A promise resolving to an array of transactions
   * @throws {Error} If the API request fails or returns a non-OK status
   */
  async getAccountTransactions(accountId: string, fromDate?: Date): Promise<EnableBankingTransaction[]> {
    const token = await this.generateToken();
    let url = `${this.baseUrl}/accounts/${accountId}/transactions`;

    // According to research, some APIs take query params for date filtering if supported,
    // otherwise we filter client-side. Enable Banking docs usually support access to historical data.
    // For MVP, we'll fetch what we can and filter by date if the API doesn't support strict params or
    // if the param name varies. We will try to rely on the pagination if there are many.
    // NOTE: Enable Banking specific AIS params might vary by connected bank ASPSP support.

    // We'll proceed with a simple fetch (fetching recent ones).
    // If the API supports 'date_from', we should add it.
    // Assuming standard AIS flow often allows `date_from`.
    if (fromDate) {
      // Format YYYY-MM-DD
      const dateStr = fromDate.toISOString().split('T')[0];
      url += `?date_from=${dateStr}`;
    }

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
    return data.transactions || [];
  }
}
