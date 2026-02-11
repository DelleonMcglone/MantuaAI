import { Toaster } from 'sonner';

/**
 * ToastProvider component for displaying toast notifications
 * Uses sonner library with dark theme and custom styling
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1a1a2e',
          border: '1px solid #2d2d44',
          color: '#e4e4e7',
        },
        classNames: {
          success: 'border-green-500/50',
          error: 'border-red-500/50',
          info: 'border-blue-500/50',
        },
      }}
      theme="dark"
      richColors
      closeButton
    />
  );
}
