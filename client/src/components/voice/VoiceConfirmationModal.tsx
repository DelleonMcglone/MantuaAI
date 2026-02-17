/**
 * VoiceConfirmationModal — confirms parsed voice commands before execution.
 * Shows raw transcript + structured summary. Keyboard-accessible; no external libraries.
 * P1-044
 */
import React, { useEffect, useCallback } from 'react';
import type { SwapCommand, LiquidityCommand } from '@shared/voiceCommandParser';
import { VoiceCommandSummary } from './VoiceCommandSummary';

export type { SwapCommand, LiquidityCommand };
export type ParsedCommand = SwapCommand | LiquidityCommand;

interface Props {
  isOpen: boolean;
  transcript: string;
  command: ParsedCommand | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const BTN_BASE: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14 };

export default function VoiceConfirmationModal({ isOpen, transcript, command, onConfirm, onCancel }: Props) {
  const handleKeyDown = useCallback((e: globalThis.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && command) onConfirm();
  }, [isOpen, command, onConfirm, onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="vcm-title" onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1f2937', borderRadius: 12, padding: 24, maxWidth: 440, width: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid #374151' }}>
        <h2 id="vcm-title" style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 600, color: '#f9fafb' }}>
          Voice Command
        </h2>
        <blockquote style={{ margin: 0, padding: '10px 14px', background: '#111827', borderLeft: '3px solid #4b5563', borderRadius: 6, color: '#9ca3af', fontStyle: 'italic', fontSize: 14 }}>
          "{transcript}"
        </blockquote>
        {command ? (
          <>
            <div style={{ marginTop: 12, padding: 12, background: '#111827', borderRadius: 8, border: '1px solid #374151', color: '#f9fafb' }}>
              <VoiceCommandSummary command={command} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button type="button" onClick={onCancel} style={{ ...BTN_BASE, border: '1px solid #4b5563', background: 'transparent', color: '#9ca3af' }}>Cancel</button>
              <button type="button" onClick={onConfirm} autoFocus style={{ ...BTN_BASE, padding: '8px 20px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 600 }}>Confirm</button>
            </div>
          </>
        ) : (
          <>
            <p style={{ marginTop: 12, color: '#ef4444', fontSize: 14 }}>Could not understand command.</p>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onCancel} autoFocus style={{ ...BTN_BASE, border: '1px solid #4b5563', background: 'transparent', color: '#9ca3af' }}>Dismiss</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
