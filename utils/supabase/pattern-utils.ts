import { createClient } from '@/utils/supabase/client'
import { Transaction, TitleSuggestion, TitleSuggestionInput } from '@/types/database'

/**
 * Provides static methods for managing transaction title patterns.
 *
 * Title patterns are used to suggest previously-used transaction titles
 * when entering a new transaction, grouped by type and category. The
 * class reads from and writes to the `transaction_title_patterns` table
 * in Supabase.
 */
export class TransactionPatternService {
  /**
   * Updates (upserts) a title pattern record whenever a transaction is
   * created or updated.
   *
   * While a database trigger normally handles this automatically, this
   * method is available for manual synchronisation when needed.
   *
   * @param transaction - The transaction whose title/category data should
   *   be reflected in the patterns table.
   * @throws {Error} If the current user is not authenticated.
   */
  static async updatePatterns(transaction: Transaction): Promise<void> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // The database trigger should handle this automatically,
    // but we provide this method for manual updates if needed
    const { error } = await supabase
      .from('transaction_title_patterns')
      .upsert({
        user_id: user.id,
        title: transaction.title,
        type: transaction.type,
        main_category: transaction.main_category,
        sub_category: transaction.sub_category,
        frequency: 1,
        last_used_at: transaction.date
      }, {
        onConflict: 'user_id,title,type,main_category,sub_category',
        ignoreDuplicates: false
      })

    if (error) {
      console.error('Failed to update title patterns:', error)
      // Don't throw error as this is a non-critical operation
    }
  }

  /**
   * Retrieves title suggestions matching the given query string.
   *
   * Results are ordered by most recently used first, then by frequency,
   * and limited to the specified count.
   *
   * @param query - A partial title string to search for (case-insensitive).
   * @param limit - Maximum number of suggestions to return (default `10`).
   * @returns An array of matching title suggestions.
   * @throws {Error} If the current user is not authenticated or the query fails.
   */
  static async getSuggestions(query: string, limit: number = 10): Promise<TitleSuggestion[]> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
      .from('transaction_title_patterns')
      .select('*')
      .eq('user_id', user.id)
      .ilike('title', `%${query}%`)
      .order('last_used_at', { ascending: false })
      .order('frequency', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get title suggestions: ${error.message}`)
    }

    return data || []
  }

  /**
   * Increments the usage frequency of a given title pattern, or inserts a
   * new record if one does not already exist.
   *
   * @param suggestion - The pattern data (title, type, category) whose
   *   frequency counter should be incremented. The `frequency` field on the
   *   input is treated as the existing count and incremented by 1.
   * @throws {Error} If the current user is not authenticated.
   */
  static async incrementFrequency(suggestion: TitleSuggestionInput): Promise<void> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { error } = await supabase
      .from('transaction_title_patterns')
      .upsert({
        user_id: user.id,
        title: suggestion.title,
        type: suggestion.type,
        main_category: suggestion.main_category,
        sub_category: suggestion.sub_category,
        frequency: suggestion.frequency + 1,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,title,type,main_category,sub_category'
      })

    if (error) {
      console.error('Failed to increment pattern frequency:', error)
    }
  }

  /**
   * Cleans up old / stale title patterns for the current user.
   *
   * Delegates to the `cleanup_old_title_patterns` database RPC. This is
   * intended for admin or maintenance use.
   *
   * @throws {Error} If the current user is not authenticated.
   */
  static async cleanupOldPatterns(): Promise<void> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { error } = await supabase
      .rpc('cleanup_old_title_patterns')

    if (error) {
      console.error('Failed to cleanup old patterns:', error)
    }
  }

  /**
   * Returns the user's most frequently used title patterns.
   *
   * @param limit - Maximum number of patterns to return (default `20`).
   * @returns An array of top title suggestions ordered by recency and frequency.
   * @throws {Error} If the current user is not authenticated or the query fails.
   */
  static async getTopPatterns(limit: number = 20): Promise<TitleSuggestion[]> {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
      .from('transaction_title_patterns')
      .select('*')
      .eq('user_id', user.id)
      .order('last_used_at', { ascending: false })
      .order('frequency', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get top patterns: ${error.message}`)
    }

    return data || []
  }
}
