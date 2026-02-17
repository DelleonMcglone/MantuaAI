/**
 * PushToTalkButton — voice input with push-to-talk, text fallback, and error handling.
 * P1-039 (recording), P1-045 (text fallback), P1-046 (error states).
 * Uses only MediaRecorder API and fetch; no external audio libraries.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { MicSVG, SpinnerSVG, XSvg, SendSVG } from './VoiceIcons';

type ButtonState = 'idle' | 'recording' | 'processing' | 'error';
const FALLBACK_KEY = 'mantua_voice_fallback_preferred';

export interface PushToTalkButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function PushToTalkButton({ onTranscription, disabled = false, className = '' }: PushToTalkButtonProps) {
  const { startRecording, stopRecording, isRecording, error: recorderError, clearError } = useAudioRecorder();
  const [buttonState, setButtonState] = useState<ButtonState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fallbackOpen, setFallbackOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(FALLBACK_KEY) === 'true'; } catch { return false; }
  });
  const [fallbackText, setFallbackText] = useState('');
  const errorDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const isRecordingRef = useRef(false);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg); setButtonState('error');
    console.error('[PushToTalkButton]', msg);
    if (errorDismissRef.current) clearTimeout(errorDismissRef.current);
    errorDismissRef.current = setTimeout(() => { setErrorMsg(null); setButtonState('idle'); clearError(); }, 5_000);
  }, [clearError]);

  useEffect(() => { if (recorderError) showError(recorderError); }, [recorderError, showError]);
  useEffect(() => {
    if (recorderError && (recorderError.includes('denied') || recorderError.includes("doesn't support"))) {
      setFallbackOpen(true);
      try { localStorage.setItem(FALLBACK_KEY, 'true'); } catch { /* ignore */ }
    }
  }, [recorderError]);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA' && !t.isContentEditable) {
        e.preventDefault(); setFallbackOpen(true);
        try { localStorage.setItem(FALLBACK_KEY, 'true'); } catch { /* ignore */ }
        setTimeout(() => fallbackInputRef.current?.focus(), 0);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePressStart = useCallback(async () => {
    if (disabled || isRecordingRef.current || fallbackOpen) return;
    clearError(); setErrorMsg(null); isRecordingRef.current = true; setButtonState('recording');
    try { await startRecording(); } catch { isRecordingRef.current = false; }
  }, [disabled, fallbackOpen, startRecording, clearError]);

  const handlePressEnd = useCallback(async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false; setButtonState('processing');
    let blob: Blob;
    try { blob = await stopRecording(); } catch { showError('Failed to stop recording. Please try again.'); return; }
    if (!blob || blob.size === 0) { showError('No speech detected. Please try again.'); return; }
    try {
      const form = new FormData();
      form.append('audio', blob, 'audio.webm');
      const resp = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({})) as { error?: string };
        console.error('[PushToTalkButton] transcribe error:', body.error);
        showError(resp.status === 503
          ? 'Transcription service unavailable. Please try again later.'
          : 'Voice transcription failed. Please try again or type your command.');
        return;
      }
      const data = await resp.json() as { transcript?: string };
      const transcript = data.transcript?.trim() ?? '';
      if (!transcript) { showError('No speech detected. Please try again.'); return; }
      setButtonState('idle'); onTranscription(transcript);
    } catch (err) {
      console.error('[PushToTalkButton] network error:', err);
      showError('Voice transcription failed. Please try again or type your command.');
    }
  }, [stopRecording, onTranscription, showError]);

  const handleFallbackSubmit = useCallback(() => {
    const text = fallbackText.trim(); if (!text) return;
    setFallbackText(''); onTranscription(text);
  }, [fallbackText, onTranscription]);

  const toggleFallback = useCallback(() => {
    setFallbackOpen(prev => { const next = !prev; try { localStorage.setItem(FALLBACK_KEY, String(next)); } catch { /* ignore */ }
      if (next) setTimeout(() => fallbackInputRef.current?.focus(), 0); return next; });
  }, []);

  const btnBg = buttonState === 'recording' ? '#ef4444' : buttonState === 'error' ? '#ef4444' : buttonState === 'processing' ? '#6366f1' : 'transparent';
  const pulse: React.CSSProperties = buttonState === 'recording' ? { animation: 'ptb-pulse 1s ease-in-out infinite' } : {};

  return (
    <>
      <style>{`@keyframes ptb-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}@keyframes ptb-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button type="button" aria-label={isRecording ? 'Recording… release to stop' : 'Hold to record voice'} aria-pressed={isRecording}
          disabled={disabled || buttonState === 'processing' || fallbackOpen}
          onMouseDown={handlePressStart} onMouseUp={handlePressEnd} onMouseLeave={handlePressEnd}
          onTouchStart={e => { e.preventDefault(); handlePressStart(); }} onTouchEnd={e => { e.preventDefault(); handlePressEnd(); }}
          style={{ background: btnBg, border: buttonState === 'idle' ? '1px solid #444' : 'none', borderRadius: 8, padding: 8,
            cursor: disabled || buttonState === 'processing' || fallbackOpen ? 'not-allowed' : 'pointer',
            color: buttonState === 'idle' ? '#9ca3af' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: disabled ? 0.4 : 1, transition: 'background 0.15s', ...pulse }}>
          {buttonState === 'processing' ? <SpinnerSVG /> : buttonState === 'error' ? <XSvg /> : <MicSVG />}
        </button>
        {errorMsg && <p role="alert" style={{ fontSize: 11, color: '#ef4444', maxWidth: 160, textAlign: 'center', margin: 0, lineHeight: 1.3 }}>{errorMsg}</p>}
        <button type="button" onClick={toggleFallback} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6b7280', textDecoration: 'underline', padding: '2px 0' }}>
          {fallbackOpen ? 'Use voice' : 'Type instead'}
        </button>
        {fallbackOpen && (
          <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
            <input ref={fallbackInputRef} type="text" value={fallbackText} onChange={e => setFallbackText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFallbackSubmit()} placeholder="Type command…" disabled={disabled}
              style={{ flex: 1, fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid #444', background: 'transparent', color: 'inherit', outline: 'none', minWidth: 0 }} />
            <button type="button" onClick={handleFallbackSubmit} disabled={disabled || !fallbackText.trim()} aria-label="Send"
              style={{ background: 'transparent', border: '1px solid #444', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
              <SendSVG />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
