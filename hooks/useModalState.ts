import { useState, useCallback } from 'react'
import { Transaction } from '@/types/database'

/**
 * Hook to manage add/edit modal visibility and transaction selection.
 *
 * Provides state and actions for opening and closing an "add transaction" modal
 * and an "edit transaction" modal. The editing transaction reference is preserved
 * briefly after closing to allow exit animations to complete.
 *
 * @returns An object containing:
 *  - `showAddModal`: `true` when the add-transaction modal is open.
 *  - `editingTransaction`: The transaction being edited, or `null`.
 *  - `isEditModalOpen`: `true` when the edit-transaction modal is open.
 *  - `openAddModal`: Opens the add-transaction modal.
 *  - `closeAddModal`: Closes the add-transaction modal.
 *  - `openEditModal`: Opens the edit modal for a specific transaction.
 *  - `closeEditModal`: Closes the edit modal.
 *  - `closeAllModals`: Closes both modals.
 *  - `hasOpenModal`: Computed boolean — `true` when either modal is open.
 */
export function useModalState() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const openAddModal = useCallback(() => {
    setShowAddModal(true)
  }, [])

  const closeAddModal = useCallback(() => {
    setShowAddModal(false)
  }, [])

  const openEditModal = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction)
    setIsEditModalOpen(true)
  }, [])

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false)
    // Don't clear editingTransaction immediately to allow animation to complete
  }, [])

  const closeAllModals = useCallback(() => {
    setShowAddModal(false)
    setIsEditModalOpen(false)
    // Don't clear editingTransaction immediately
  }, [])

  return {
    // State
    showAddModal,
    editingTransaction,
    isEditModalOpen,

    // Actions
    openAddModal,
    closeAddModal,
    openEditModal,
    closeEditModal,
    closeAllModals,

    // Computed
    hasOpenModal: showAddModal || isEditModalOpen
  }
}
