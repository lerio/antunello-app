import { createClient } from '@/utils/supabase/client'
import { Transaction, TitleSuggestion, TitleSuggestionInput } from '@/types/database'

/**
 * Service to manage transaction title patterns and suggestions
 */
export class TransactionPatternService {
  /**
   * Update patterns when a transaction is created or updated
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
   * Get title suggestions for a given query
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
   * Manually increment frequency for a pattern
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
   * Clean up old patterns (admin function)
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
   * Get user's most frequent patterns
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