/**
 * Vowel Caption Manager Hook
 *
 * Manages caption state and transcript events for the Vowel voice agent.
 * Subscribes to client.onTranscriptEvent and accumulates streaming deltas.
 * Copied from @vowel.to/client for local control (no package source edits).
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useVowel } from "@vowel.to/client/react";

/** Caption state shown in the UI. */
export interface CaptionState {
  text: string;
  role: "user" | "assistant";
  isVisible: boolean;
  timestamp: Date;
  isStreaming: boolean;
}

interface StreamingState {
  responseId: string | null;
  text: string;
  role: "user" | "assistant";
}

function accumulateDelta(currentText: string, deltaText: string): string {
  if (!deltaText) return currentText;
  if (!currentText) return deltaText;
  const needsSpace =
    !currentText.endsWith(" ") && !deltaText.startsWith(" ");
  return currentText + (needsSpace ? " " : "") + deltaText;
}

export function useVowelCaptionManager() {
  const { client } = useVowel();
  const [caption, setCaption] = useState<CaptionState | null>(null);
  const streamingStateRef = useRef<StreamingState>({
    responseId: null,
    text: "",
    role: "assistant",
  });

  const captionConfig = client?.getConfig()._caption;
  const showStreaming = captionConfig?.showStreaming ?? true;
  const showDeltaSumOnly = captionConfig?._showDeltaSumOnly ?? false;

  const showCaption = useCallback(
    (text: string, role: "user" | "assistant", isStreaming = false) => {
      if (!text.trim()) return;
      setCaption({
        text: text.trim(),
        role,
        isVisible: true,
        timestamp: new Date(),
        isStreaming,
      });
    },
    [],
  );

  const dismissCaption = useCallback(() => {
    setCaption((prev) => (prev ? { ...prev, isVisible: false } : null));
    setTimeout(() => {
      setCaption(null);
      streamingStateRef.current = {
        responseId: null,
        text: "",
        role: "assistant",
      };
    }, 300);
  }, []);

  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.onTranscriptEvent((event) => {
      if (event.type === "delta" && showStreaming) {
        const currentState = streamingStateRef.current;
        const isReset = !event.text && event.responseId;
        const isNewResponse =
          event.responseId &&
          (event.responseId !== currentState.responseId || isReset);

        if (isNewResponse) {
          streamingStateRef.current = {
            responseId: event.responseId || null,
            text: event.text || "",
            role: event.role,
          };
        } else if (event.text) {
          const accumulatedText = accumulateDelta(currentState.text, event.text);
          streamingStateRef.current = {
            ...currentState,
            text: accumulatedText,
          };
        }

        if (streamingStateRef.current.text) {
          showCaption(streamingStateRef.current.text, event.role, true);
        }
      } else if (event.type === "done") {
        if (showDeltaSumOnly) {
          const accumulatedText = streamingStateRef.current.text;
          if (accumulatedText) {
            showCaption(accumulatedText, event.role, false);
          }
        } else if (event.text) {
          showCaption(event.text, event.role, false);
        }

        streamingStateRef.current = {
          responseId: null,
          text: "",
          role: "assistant",
        };
      }
    });

    return () => unsubscribe();
  }, [client, showCaption, showStreaming]);

  return { caption, dismissCaption, showCaption };
}
