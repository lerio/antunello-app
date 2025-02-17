'use client'

import { useEffect, useState } from 'react'
import { XIcon } from 'lucide-react'

type NotificationProps = {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}

export default function Notification({ message, type = 'success', onClose }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose()
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  if (!isVisible) return null

  const bgColor = type === 'success' ? 'bg-green-50' : 'bg-red-50'
  const textColor = type === 'success' ? 'text-green-800' : 'text-red-800'
  const borderColor = type === 'success' ? 'border-green-200' : 'border-red-200'

  return (
    <div className={`fixed top-4 right-4 p-4 rounded-lg border ${bgColor} ${textColor} ${borderColor} shadow-lg max-w-sm`}>
      <div className="flex items-center justify-between">
        <p>{message}</p>
        <button
          onClick={() => {
            setIsVisible(false)
            onClose()
          }}
          className="ml-4 text-gray-400 hover:text-gray-600"
        >
          <XIcon size={16} />
        </button>
      </div>
    </div>
  )
} 