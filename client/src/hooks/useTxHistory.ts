/**
 * useTxHistory.ts
 * Persists and retrieves the last 20 transactions in localStorage.
 * Call addTx() after any user-initiated transaction.
 */
import { useState, useCallback } from 'react';

export type TxStatus = 'pending' | 'success' | 'failed';
export type TxType =
  | 'swap'
  | 'add_liquidity'
  | 'remove_liquidity'
  | 'transfer'
  | 'bet'
  | 'claim'
  | 'other';

export interface TxRecord {
  hash: string;
  type: TxType;
  status: TxStatus;
  /** e.g. "Swap 0.1 ETH → USDC" */
  summary: string;
  timestamp: number;
  chainId: number;
  /** USD value if known, e.g. "$42.00" */
  value?: string;
}

const STORAGE_KEY = 'mantua_tx_history';
const MAX_TXS = 20;

function loadFromStorage(): TxRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(txs: TxRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
  } catch {}
}

export function useTxHistory() {
  const [history, setHistory] = useState<TxRecord[]>(loadFromStorage);

  const addTx = useCallback((tx: Omit<TxRecord, 'timestamp'>) => {
    setHistory(prev => {
      const next = [{ ...tx, timestamp: Date.now() }, ...prev].slice(0, MAX_TXS);
      saveToStorage(next);
      return next;
    });
  }, []);

  const updateTxStatus = useCallback((hash: string, status: TxStatus) => {
    setHistory(prev => {
      const next = prev.map(tx => (tx.hash === hash ? { ...tx, status } : tx));
      saveToStorage(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addTx, updateTxStatus, clearHistory };
}
