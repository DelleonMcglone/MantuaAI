/**
 * ErrorState.tsx
 * Inline error card for failed data fetches.
 * Shows a readable message and a retry button.
 */
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({
  message = 'Something went wrong. Please try again.',
  onRetry,
  compact = false,
}: ErrorStateProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-900/20
                      border border-red-800/50 rounded-xl">
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <p className="text-xs text-red-300 flex-1">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-red-400 hover:text-red-300 underline flex-shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-12 h-12 rounded-full bg-red-900/20 border border-red-800/50
                      flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-sm text-gray-400 text-center max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700
                     border border-gray-700 rounded-xl text-sm text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      )}
    </div>
  );
}
