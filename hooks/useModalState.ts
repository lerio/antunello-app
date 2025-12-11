import { useState, useCallback } from 'react'
import { Transaction } from '@/types/database'

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