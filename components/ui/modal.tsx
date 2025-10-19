import { useEffect, useState, useCallback } from 'react'

interface ModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly children: React.ReactNode
}

const ANIMATION_DURATION = 300

export function Modal({ isOpen, onClose, children }: ModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)

  const handleSwipeDown = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    const startY = touch.clientY
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentTouch = moveEvent.touches[0]
      const deltaY = currentTouch.clientY - startY
      
      if (deltaY > 50) {
        onClose()
        cleanup()
      }
    }
    
    const cleanup = () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', cleanup)
    }
    
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', cleanup, { passive: true })
  }, [onClose])

  // Handle all modal state changes in a single effect
  useEffect(() => {
    if (isOpen) {
      // Opening modal
      setShouldRender(true)
      document.body.style.overflow = 'hidden'
      setIsAnimating(false)
      
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true))
      })
    } else if (shouldRender) {
      // Closing modal
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setShouldRender(false)
        document.body.style.overflow = 'unset'
      }, ANIMATION_DURATION)
      
      return () => clearTimeout(timer)
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, shouldRender])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (shouldRender) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [shouldRender, onClose])

  if (!shouldRender) return null

  const maxHeightStyle = 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)'

  // Keyboard support for closing via overlay
  const handleOverlayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-50 overflow-hidden bg-black/50 flex items-end justify-center transition-opacity duration-300 ease-out ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
      onKeyDown={handleOverlayKeyDown}
    >
      <div 
        className={`relative w-full max-w-md sm:max-w-lg md:max-w-4xl mx-1 sm:mx-2 mb-2 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ease-out ${
          isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        style={{ maxHeight: maxHeightStyle }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Modal dialog"
      >
        {/* Interactive Handle Bar */}
        <button 
          type="button"
          className="w-full flex items-center justify-center py-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer select-none active:bg-gray-50 dark:active:bg-gray-800 transition-colors"
          onClick={onClose}
          onTouchStart={handleSwipeDown}
          aria-label="Close modal - tap or swipe down"
        >
          <div className="w-12 h-1 bg-gray-400 dark:bg-gray-500 rounded-full" />
        </button>

        {/* Scrollable Content */}
        <div 
          className="overflow-y-auto overflow-x-hidden" 
          style={{ maxHeight: maxHeightStyle }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}