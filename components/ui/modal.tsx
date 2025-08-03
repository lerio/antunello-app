import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  // Handle modal opening/closing with proper animations
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true)
      setIsAnimating(false) // Start with closed state
      // Small delay to ensure the element is rendered before animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true) // Trigger opening animation
        })
      })
    } else if (shouldRender) {
      // Start closing animation
      setIsAnimating(false)
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen, shouldRender])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (shouldRender) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [shouldRender])

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (shouldRender) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [shouldRender, onClose])

  if (!shouldRender) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-end justify-center">
        <div 
          className={`
            relative w-full max-w-4xl mx-4 mb-4 bg-white rounded-t-2xl shadow-2xl
            transform transition-all duration-300 ease-out
            ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
          `}
          style={{
            maxHeight: 'calc(100vh - 2rem)',
          }}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <X size={20} className="text-gray-600" />
          </button>

          {/* Scrollable Content */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}