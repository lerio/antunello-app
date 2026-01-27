import * as jose from 'jose';

// Define the shape of the Enable Banking configuration
interface EnableBankingConfig {
  appKey: string; // The private key (PEM format)
  kid: string;    // Key ID (often the same as App ID or specific KID)
  appId: string;  // Application ID
}

// Define response types (simplified)
interface EnableBankingTransaction {
  transaction_id?: string;
  entry_reference?: string; // Alternative ID field used by some banks
  booking_date: string; // YYYY-MM-DD
  amount?: {
    currency: string;
    amount: string; // "12.34"
  };
  transaction_amount?: { // Alternative amount field name
    currency: string;
    amount: string;
  };
  remittance_information_unstructured?: string;
  remittance_information_structured?: string;
  remittance_information?: string[]; // Array format used by some banks
  creditor?: { name: string };
  debtor?: { name: string };
  // Add other fields as needed
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

export class EnableBankingClient {
  private config: EnableBankingConfig;
  private baseUrl = 'https://api.enablebanking.com';

  constructor(config: EnableBankingConfig) {
    this.config = config;
  }

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
