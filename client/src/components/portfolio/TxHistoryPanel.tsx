/**
 * TxHistoryPanel.tsx
 * Lists the last 20 transactions with status badges and BaseScan links.
 * Reads from useTxHistory hook (localStorage-backed).
 */
import { ExternalLink, CheckCircle2, XCircle, Clock, Trash2 } from 'lucide-react';
import { useTxHistory, type TxRecord } from '@/hooks/useTxHistory';

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Confirmed' },
  failed:  { icon: XCircle,      color: 'text-red-400',     label: 'Failed'    },
  pending: { icon: Clock,        color: 'text-yellow-400',  label: 'Pending'   },
} as const;

const TYPE_LABELS: Record<string, string> = {
  swap:             'Swap',
  add_liquidity:    'Add Liquidity',
  remove_liquidity: 'Remove Liquidity',
  transfer:         'Transfer',
  claim:            'Claim Payout',
  other:            'Transaction',
};

function TxRow({ tx }: { tx: TxRecord }) {
  const cfg  = STATUS_CONFIG[tx.status];
  const Icon = cfg.icon;
  const date = new Date(tx.timestamp);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const day  = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800
                    hover:bg-gray-900/50 transition-colors group">
      <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{tx.summary}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {TYPE_LABELS[tx.type] ?? tx.type} · {day} {time}
        </p>
      </div>
      {tx.value && (
        <span className="text-sm text-gray-400 flex-shrink-0">{tx.value}</span>
      )}
      <span className={`text-xs flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
      <a
        href={`https://sepolia.basescan.org/tx/${tx.hash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gray-600 hover:text-gray-300 flex-shrink-0 opacity-0
                   group-hover:opacity-100 transition-opacity"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

export function TxHistoryPanel() {
  const { history, clearHistory } = useTxHistory();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-gray-800 flex-shrink-0">
        <h3 className="text-sm font-semibold text-white">Transaction History</h3>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1 text-xs text-gray-500
                       hover:text-gray-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!history.length ? (
          <div className="flex flex-col items-center justify-center h-full
                          text-center px-6 py-12">
            <p className="text-sm text-gray-500">No transactions yet.</p>
            <p className="text-xs text-gray-600 mt-1">
              Your confirmed transactions will appear here.
            </p>
          </div>
        ) : (
          history.map(tx => <TxRow key={tx.hash} tx={tx} />)
        )}
      </div>
    </div>
  );
}
