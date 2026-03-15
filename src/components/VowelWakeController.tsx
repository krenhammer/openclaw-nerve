import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useVowel } from '@vowel.to/client/react';

const ACTIVATE_PHRASES = ['hey vowel', 'hey, vowel', 'hi vowel'];
const DEACTIVATE_PHRASES = ['bye vowel', 'goodbye vowel'];

function getSpeechRecognition(): SpeechRecognitionConstructor | undefined {
  const w = window as WindowWithSpeechRecognition;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

function normalizeTranscript(text: string): string {
  return (text || '')
    .normalize('NFKC')
    .replace(/[’`´]/g, "'")
    .replace(/[.,!?;:()[\]{}"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function matchesPhrase(text: string, phrases: string[]): boolean {
  const normalized = normalizeTranscript(text);
  if (!normalized) return false;
  return phrases.some((phrase) => normalized.includes(normalizeTranscript(phrase)));
}

function logWake(message: string, extra?: unknown) {
  if (extra !== undefined) {
    console.debug(`[VowelWake] ${message}`, extra);
    return;
  }
  console.debug(`[VowelWake] ${message}`);
}

/**
 * Replaces the old agent wake-word listener with a Vowel wake listener.
 * While Vowel is off, browser SpeechRecognition listens for "hey vowel".
 * While Vowel is on, Vowel transcript events listen for "bye vowel".
 */
interface VowelWakeControllerProps {
  wakeWordEnabled: boolean;
}

export function VowelWakeController({ wakeWordEnabled }: VowelWakeControllerProps) {
  const { client, state, toggleSession } = useVowel();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalStopRef = useRef(false);
  const startRecognitionRef = useRef<() => void>(() => {});
  const renderCountRef = useRef(0);
  useEffect(() => {
    renderCountRef.current += 1;
    logWake('Render', {
      count: renderCountRef.current,
      hasClient: Boolean(client),
      wakeWordEnabled,
      isConnected: state.isConnected,
      isConnecting: state.isConnecting,
    });
  });

  const shouldListenForWake = useMemo(
    () => Boolean(client && wakeWordEnabled && !state.isConnected && !state.isConnecting),
    [client, wakeWordEnabled, state.isConnected, state.isConnecting],
  );

  const stopRecognition = useCallback(() => {
    intentionalStopRef.current = true;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
  }, []);

  const startRecognition = useCallback(() => {
    if (!shouldListenForWake) {
      logWake('Skipping start; wake listener not needed', {
        hasClient: Boolean(client),
        wakeWordEnabled,
        isConnected: state.isConnected,
        isConnecting: state.isConnecting,
      });
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      logWake('SpeechRecognition unavailable');
      return;
    }

    intentionalStopRef.current = false;
    logWake('Starting browser wake listener');

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += ` ${event.results[i][0].transcript}`;
      }

      const normalized = normalizeTranscript(transcript);
      if (normalized) {
        logWake('Transcript received', { transcript: normalized });
      }

      if (!matchesPhrase(transcript, ACTIVATE_PHRASES)) return;

      logWake('Activation phrase matched; toggling Vowel on');
      stopRecognition();
      void toggleSession();
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      logWake('Recognition error', { error: event.error });
      if (intentionalStopRef.current) return;
      if (event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        logWake('Stopping wake listener due to permission/service denial');
        stopRecognition();
        return;
      }

      logWake('Scheduling restart after error');
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        startRecognitionRef.current();
      }, 750);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      logWake('Recognition ended', {
        intentional: intentionalStopRef.current,
        shouldListenForWake,
      });
      if (intentionalStopRef.current || !shouldListenForWake) return;

      logWake('Scheduling restart after end');
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        startRecognitionRef.current();
      }, 350);
    };

    try {
      recognition.start();
      logWake('Recognition started');
    } catch {
      recognitionRef.current = null;
      logWake('Recognition start threw; scheduling retry');
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        startRecognitionRef.current();
      }, 1200);
    }
  }, [
    client,
    shouldListenForWake,
    state.isConnected,
    state.isConnecting,
    stopRecognition,
    toggleSession,
    wakeWordEnabled,
  ]);

  useEffect(() => {
    startRecognitionRef.current = startRecognition;
  }, [startRecognition]);

  useEffect(() => {
    if (!shouldListenForWake) {
      logWake('Wake listener disabled or Vowel already active; stopping listener');
      stopRecognition();
      return;
    }

    logWake('Checking microphone permission before starting wake listener');
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        logWake('Microphone permission state', { state: result.state });
        if (result.state === 'denied') return;
        startRecognition();
      })
      .catch(() => {
        logWake('Permissions API unavailable; starting wake listener anyway');
        startRecognition();
      });

    return stopRecognition;
  }, [shouldListenForWake, startRecognition, stopRecognition]);

  useEffect(() => {
    if (!client || !wakeWordEnabled || !state.isConnected) return;

    const unsubscribe = client.onTranscriptEvent((event) => {
      if (event.role !== 'user') return;

      const transcript = event.type === 'done'
        ? event.text || ''
        : event.type === 'delta'
          ? event.text || ''
          : '';

      if (transcript) {
        logWake('Active Vowel transcript received', {
          type: event.type,
          transcript: normalizeTranscript(transcript),
        });
      }

      if (!transcript || !matchesPhrase(transcript, DEACTIVATE_PHRASES)) return;
      logWake('Deactivation phrase matched; toggling Vowel off');
      void toggleSession();
    });

    return () => unsubscribe();
  }, [client, state.isConnected, toggleSession, wakeWordEnabled]);

  useEffect(() => {
    return () => stopRecognition();
  }, [stopRecognition]);

  return null;
}
