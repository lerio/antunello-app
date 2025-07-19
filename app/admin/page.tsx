"use client";

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteAllUserTransactions, getUserTransactionCount, importTransactions } from '@/utils/supabase/database-utils';
import { parseCSV, mapCSVToTransaction, ImportResult } from '@/utils/csv-import';

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [transactionCount, setTransactionCount] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
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
      setMessage('Reading CSV file...');
      
      const csvContent = await file.text();
      const csvTransactions = parseCSV(csvContent);
      
      setMessage(`Parsed ${csvTransactions.length} transactions. Processing...`);
      
      // Get current user ID (this will be handled by the import function)
      const dbTransactions = csvTransactions.map(csvTx => 
        mapCSVToTransaction(csvTx, 'placeholder-user-id') // user_id will be set correctly in importTransactions
      );
      
      const result = await importTransactions(dbTransactions);
      setImportResult(result);
      
      if (result.success) {
        setMessage(`✅ Successfully imported ${result.imported} transactions!`);
        // Refresh count
        const newCount = await getUserTransactionCount();
        setTransactionCount(newCount);
      } else {
        setMessage(`❌ Import failed. Check errors below.`);
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
                        <li key={index} className="text-xs">• {error}</li>
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