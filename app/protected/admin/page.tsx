"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteAllUserTransactions, getUserTransactionCount, importTransactions } from '@/utils/supabase/database-utils';
import { parseCSV, batchMapCSVToTransactions, ImportResult } from '@/utils/csv-import';
import { retryMissingExchangeRates } from '@/utils/currency-conversion';

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exchangeRateResult, setExchangeRateResult] = useState<{success: number; failed: number; total: number} | null>(null);
  const [importProgress, setImportProgress] = useState<{current: number; total: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGetCount = async () => {
    try {
      setIsLoading(true);
      const count = await getUserTransactionCount();
      setTransactionCount(count);
      setMessage(`Found ${count} transactions for your account`);
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to delete ALL your transactions? This cannot be undone!')) {
      return;
    }

    try {
      setIsLoading(true);
      await deleteAllUserTransactions();
      setMessage('✅ Successfully deleted all your transactions');
      setTransactionCount(0);
      setImportResult(null);
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setMessage('❌ Please select a CSV file');
      return;
    }

    try {
      setIsLoading(true);
      setImportResult(null);
      setImportProgress(null);
      setMessage('Reading CSV file...');
      
      const csvContent = await file.text();
      const csvTransactions = parseCSV(csvContent);
      
      setMessage(`Parsed ${csvTransactions.length} transactions. Converting currencies...`);
      setImportProgress({ current: 0, total: csvTransactions.length });
      
      // Use batched processing with progress updates
      const dbTransactions = await batchMapCSVToTransactions(
        csvTransactions, 
        'placeholder-user-id', // user_id will be set correctly in importTransactions
        (processed, total) => {
          setImportProgress({ current: processed, total });
          setMessage(`Converting currencies... ${processed}/${total} transactions processed`);
        }
      );
      
      setMessage(`Currency conversion complete. Importing ${dbTransactions.length} transactions to database...`);
      setImportProgress(null);
      
      console.log('About to import transactions:', dbTransactions.length);
      console.log('First transaction sample:', dbTransactions[0]);
      
      // Add a timeout to prevent infinite hanging
      const importPromise = importTransactions(dbTransactions);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Import timeout after 2 minutes')), 120000)
      );
      
      const result = await Promise.race([importPromise, timeoutPromise]) as ImportResult;
      console.log('Import result:', result);
      
      setImportResult(result);
      
      if (result.success) {
        setMessage(`✅ Successfully imported ${result.imported} transactions!`);
        // Refresh count
        const newCount = await getUserTransactionCount();
        setTransactionCount(newCount);
      } else {
        setMessage(`❌ Import failed. Check errors below.`);
        console.error('Import failed with errors:', result.errors);
      }
      
    } catch (error) {
      setMessage(`❌ Error importing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRetryExchangeRates = async () => {
    try {
      setIsLoading(true);
      setMessage('Fetching missing exchange rates...');
      
      // Try for the most common currencies in your data
      const currencies = ['JPY', 'USD'];
      let totalSuccess = 0;
      let totalFailed = 0;
      let totalTotal = 0;
      
      for (const currency of currencies) {
        const result = await retryMissingExchangeRates(currency);
        totalSuccess += result.success;
        totalFailed += result.failed;
        totalTotal += result.total;
      }
      
      setExchangeRateResult({
        success: totalSuccess,
        failed: totalFailed,
        total: totalTotal
      });
      
      if (totalSuccess > 0) {
        setMessage(`✅ Successfully fetched ${totalSuccess} missing exchange rates!`);
      } else if (totalTotal === 0) {
        setMessage(`✅ No missing exchange rates found`);
      } else {
        setMessage(`❌ Failed to fetch ${totalFailed} exchange rates`);
      }
      
    } catch (error) {
      setMessage(`❌ Error fetching exchange rates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed-width-container py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Import CSV Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">📤 Import CSV Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isLoading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Select a CSV file exported from your finance app (Cashew format supported)
              </p>
            </div>

            {importProgress && (
              <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-sm">
                <div className="font-medium text-blue-800 dark:text-blue-200">Processing...</div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs mt-1 text-blue-700 dark:text-blue-300">
                    {importProgress.current} of {importProgress.total} transactions
                  </p>
                </div>
              </div>
            )}

            {importResult && (
              <div className="space-y-2">
                <div className="p-3 rounded-md bg-muted text-sm">
                  <div className="font-medium">Import Results:</div>
                  <ul className="mt-1 space-y-1">
                    <li>✅ Imported: {importResult.imported} transactions</li>
                    <li>⚠️ Skipped: {importResult.skipped} transactions</li>
                    <li>❌ Errors: {importResult.errors.length}</li>
                  </ul>
                </div>
                
                {importResult.errors.length > 0 && (
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm">
                    <div className="font-medium text-red-800 dark:text-red-200">Errors:</div>
                    <ul className="mt-1 space-y-1 text-red-700 dark:text-red-300">
                      {importResult.errors.slice(0, 10).map((error, index) => (
                        <li key={`error-${error}-${index}`} className="text-xs">• {error}</li>
                      ))}
                      {importResult.errors.length > 10 && (
                        <li className="text-xs">... and {importResult.errors.length - 10} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Management Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">📊 Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button
                onClick={handleGetCount}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? 'Loading...' : 'Check Transaction Count'}
              </Button>
              
              {transactionCount !== null && (
                <p className="text-sm text-muted-foreground">
                  You have {transactionCount} transactions
                </p>
              )}
            </div>

            {message && (
              <div className="p-3 rounded-md bg-muted text-sm">
                {message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Exchange Rates Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-600">💱 Currency Exchange Rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Button
                onClick={handleRetryExchangeRates}
                disabled={isLoading}
                variant="outline"
                className="w-full"
              >
                {isLoading ? 'Fetching...' : 'Fetch Missing Exchange Rates'}
              </Button>
              
              <p className="text-xs text-muted-foreground">
                Retry fetching exchange rates for dates that previously failed
              </p>
            </div>

            {exchangeRateResult && (
              <div className="p-3 rounded-md bg-muted text-sm">
                <div className="font-medium">Exchange Rate Results:</div>
                <ul className="mt-1 space-y-1">
                  <li>✅ Fetched: {exchangeRateResult.success} rates</li>
                  <li>❌ Failed: {exchangeRateResult.failed} rates</li>
                  <li>📊 Total missing: {exchangeRateResult.total} rates</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clear Data Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">⚠️ Clear All Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleClearData}
              disabled={isLoading || transactionCount === 0}
              variant="destructive"
              className="w-full"
            >
              {isLoading ? 'Deleting...' : 'Delete All My Transactions'}
            </Button>

            <div className="text-xs text-muted-foreground">
              <p>⚠️ This will only delete YOUR transactions (user-specific).</p>
              <p>This action cannot be undone.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}