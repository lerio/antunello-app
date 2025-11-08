import { useEffect, useRef } from 'react';

/**
 * Custom hook to protect form fields from browser extension errors
 * This prevents extensions from causing "Cannot read properties of undefined" errors
 * when they try to access form field properties during focus events
 */
export function useFormFieldProtection(fieldId: string) {
  const fieldRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const field = document.getElementById(fieldId) as HTMLInputElement;
    if (!field) return;

    fieldRef.current = field;

    // More aggressive approach for 1Password extension
    const addComprehensiveDefensiveProperties = () => {
      try {
        // Ensure the field has all expected properties that 1Password might access
        if (field) {
          // Add 'control' property that 1Password expects
          Object.defineProperty(field, 'control', {
            value: field,
            writable: false,
            configurable: true
          });

          // Add 'form' property
          Object.defineProperty(field, 'form', {
            value: field.closest('form'),
            writable: false,
            configurable: true
          });

          // Add 'ownerDocument' property
          Object.defineProperty(field, 'ownerDocument', {
            value: document,
            writable: false,
            configurable: true
          });

          // Add 'type' property if missing (1Password might check this)
          if (!field.type) {
            Object.defineProperty(field, 'type', {
              value: 'text',
              writable: false,
              configurable: true
            });
          }

          // Add 'name' property if missing
          if (!field.name) {
            Object.defineProperty(field, 'name', {
              value: fieldId,
              writable: false,
              configurable: true
            });
          }

          // Add 'id' property if missing
          if (!field.id) {
            Object.defineProperty(field, 'id', {
              value: fieldId,
              writable: false,
              configurable: true
            });
          }
        }
      } catch (error) {
        // Silently ignore errors during property definition
      }
    };

    // Add properties immediately
    addComprehensiveDefensiveProperties();

    // Also intercept and wrap the extension's event handlers
    const originalAddEventListener = field.addEventListener;

    field.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) {
      // Intercept focus-related events to add properties before extension code runs
      if (type === 'focus' || type === 'focusin' || type === 'click') {
        const wrappedListener = (event: Event) => {
          try {
            // Add defensive properties BEFORE calling the original listener
            addComprehensiveDefensiveProperties();

            // Call the original listener
            if (typeof listener === 'function') {
              listener.call(this, event);
            } else if (listener && typeof listener.handleEvent === 'function') {
              listener.handleEvent(event);
            }
          } catch (error) {
            // Silently catch extension errors to prevent console pollution
            console.debug('Extension error caught and suppressed:', error);
          }
        };

        return originalAddEventListener.call(this, type, wrappedListener, options);
      }

      return originalAddEventListener.call(this, type, listener, options);
    };

    // Add properties on mouseenter as well
    const handleMouseEnter = () => {
      addComprehensiveDefensiveProperties();
    };

    field.addEventListener('mouseenter', handleMouseEnter);

    // Cleanup function
    return () => {
      // Restore original addEventListener
      if (fieldRef.current) {
        fieldRef.current.addEventListener = originalAddEventListener;
        fieldRef.current.removeEventListener('mouseenter', handleMouseEnter);
      }
    };
  }, [fieldId]);

  return fieldRef;
}