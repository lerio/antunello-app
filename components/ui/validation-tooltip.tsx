import React, { useRef } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  arrow,
  FloatingArrow,
} from '@floating-ui/react';
import { AlertCircle } from 'lucide-react';

type ValidationTooltipProps = Readonly<{
  message: string;
  isVisible: boolean;
  onClose?: () => void;
  children: React.ReactElement;
}>;

export function ValidationTooltip({ 
  message, 
  isVisible, 
  onClose,
  children 
}: ValidationTooltipProps) {
  const arrowRef = useRef(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isVisible,
    onOpenChange: (open) => {
      if (!open && onClose && isVisible) {
        onClose();
      }
    },
    middleware: [
      offset(10),
      flip(),
      shift({ padding: 8 }),
      arrow({ element: arrowRef }),
    ],
    whileElementsMounted: autoUpdate,
    placement: 'top',
  });

  const hover = useHover(context, {
    enabled: false, // Disable hover tooltips entirely - only show validation errors
  });
  const focus = useFocus(context, {
    enabled: false, // Disable focus tooltips entirely - only show validation errors
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      {/* Clone the child element and add ref + props */}
      <div ref={refs.setReference} {...getReferenceProps()}>
        {children}
      </div>

      {isVisible && message && (
        <FloatingPortal>
          <div
            className="z-50 px-3 py-2 text-sm font-medium text-white rounded-lg shadow-lg max-w-xs bg-red-600 dark:bg-red-700"
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{message}</span>
            </div>
            <FloatingArrow
              ref={arrowRef}
              context={context}
              className="fill-red-600 dark:fill-red-700"
            />
          </div>
        </FloatingPortal>
      )}
    </>
  );
}