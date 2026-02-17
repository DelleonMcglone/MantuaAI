/**
 * useAudioRecorder
 * Custom hook for recording audio via the MediaRecorder API.
 * Supports webm/ogg, auto-detects browser support, enforces a 30-second limit,
 * and provides human-readable error messages for all failure modes.
 */

import { useRef, useCallback, useState } from 'react';

// ============ TYPES ============

export interface UseAudioRecorderReturn {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  isRecording: boolean;
  error: string | null;
  clearError: () => void;
}

// ============ HELPERS ============

const MAX_DURATION_MS = 30_000;

function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

// ============ HOOK ============

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopResolveRef = useRef<((blob: Blob) => void) | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const startRecording = useCallback(async (): Promise<void> => {
    setError(null);

    // Browser support check
    if (typeof MediaRecorder === 'undefined') {
      const msg = "Your browser doesn't support voice input. Use text input instead.";
      setError(msg);
      console.error('[useAudioRecorder] MediaRecorder not supported');
      throw new Error(msg);
    }

    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      const msg = "Your browser doesn't support voice input. Use text input instead.";
      setError(msg);
      console.error('[useAudioRecorder] No supported MIME type found');
      throw new Error(msg);
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: unknown) {
      console.error('[useAudioRecorder] getUserMedia error:', err);
      const domErr = err as DOMException;
      if (domErr.name === 'NotAllowedError' || domErr.name === 'PermissionDeniedError') {
        const msg = 'Microphone access denied. Use text input instead.';
        setError(msg);
        throw new Error(msg);
      }
      if (domErr.name === 'NotFoundError' || domErr.name === 'DevicesNotFoundError') {
        const msg = 'No microphone found on this device.';
        setError(msg);
        throw new Error(msg);
      }
      const msg = 'Could not access microphone. Please check permissions.';
      setError(msg);
      throw new Error(msg);
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (stopResolveRef.current) {
        stopResolveRef.current(blob);
        stopResolveRef.current = null;
      }
      setIsRecording(false);
    };

    recorder.start(100);
    setIsRecording(true);

    // Auto-stop after 30 seconds
    timeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        const msg = 'Recording stopped — 30 second limit reached.';
        setError(msg);
        console.warn('[useAudioRecorder] 30-second limit reached');
        mediaRecorderRef.current.stop();
      }
    }, MAX_DURATION_MS);
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise<Blob>((resolve) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== 'recording') {
        resolve(new Blob([], { type: 'audio/webm' }));
        return;
      }

      stopResolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  return { startRecording, stopRecording, isRecording, error, clearError };
}
