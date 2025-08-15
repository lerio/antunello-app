import { useState, useCallback } from 'react'
import { Transaction } from '@/types/database'

export function useModalState() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const openAddModal = useCallback(() => {
    setShowAddModal(true)
  }, [])

  const closeAddModal = useCallback(() => {
    setShowAddModal(false)
  }, [])

  const openEditModal = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction)
  }, [])

  const closeEditModal = useCallback(() => {
    setEditingTransaction(null)
  }, [])

  const closeAllModals = useCallback(() => {
    setShowAddModal(false)
    setEditingTransaction(null)
  }, [])

  return {
    // State
    showAddModal,
    editingTransaction,
    
    // Actions
    openAddModal,
    closeAddModal,
    openEditModal,
    closeEditModal,
    closeAllModals,
    
    // Computed
    hasOpenModal: showAddModal || !!editingTransaction
  }
}