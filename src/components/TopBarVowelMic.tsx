/**
 * TopBarVowelMic - Vowel voice mic button for the TopBar
 *
 * Renders a rounded-square button with state-specific icons:
 * - Disconnected: MicOff
 * - Connecting: Loader2 (spinner)
 * - Tool executing: Wrench
 * - AI thinking: Brain
 * - AI speaking: Volume2
 * - User speaking: Mic (listening)
 * - Connected idle: Mic
 *
 * Must be rendered inside VowelProvider.
 */
import { Mic, MicOff, Loader2, Wrench, Brain, Volume2 } from "lucide-react";
import { useVowel } from "@vowel.to/client/react";
import { cn } from "@/lib/utils";

const ICON_SIZE = 14;

export function TopBarVowelMic() {
  const { state, toggleSession, client } = useVowel();

  if (!client) {
    return null;
  }

  const isDisabled = !state.isConnected && state.isConnecting;

  /** Icon changes based on state - never stays as a single icon. */
  const getIcon = () => {
    if (state.isConnecting) {
      return <Loader2 size={ICON_SIZE} className="animate-spin" aria-hidden="true" />;
    }
    if (state.isToolExecuting) {
      return <Wrench size={ICON_SIZE} aria-hidden="true" />;
    }
    if (state.isAIThinking) {
      return <Brain size={ICON_SIZE} aria-hidden="true" />;
    }
    if (state.isAISpeaking) {
      return <Volume2 size={ICON_SIZE} aria-hidden="true" />;
    }
    if (state.isUserSpeaking) {
      return <Mic size={ICON_SIZE} aria-hidden="true" />;
    }
    if (state.isConnected) {
      return <Mic size={ICON_SIZE} aria-hidden="true" />;
    }
    return <MicOff size={ICON_SIZE} aria-hidden="true" />;
  };

  const getTitle = () => {
    if (state.isAISpeaking) return "AI Speaking";
    if (state.isToolExecuting) return "Executing Tool";
    if (state.isAIThinking) return "AI Thinking";
    if (state.isUserSpeaking) return "You're Speaking";
    return state.status || "Voice assistant";
  };

  /** Status colors – match VowelMicrophone state styling. */
  const getStatusStyles = () => {
    if (state.isConnected) {
      if (state.isAISpeaking) return "!bg-purple-500 !border-purple-500/50 text-white hover:!bg-purple-600";
      if (state.isToolExecuting) return "!bg-amber-500 !border-amber-500/50 text-white hover:!bg-amber-600";
      if (state.isAIThinking) return "!bg-yellow-500 !border-yellow-500/50 text-white hover:!bg-yellow-600";
      if (state.isUserSpeaking) return "!bg-blue-500 !border-blue-500/50 text-white hover:!bg-blue-600";
      return "!bg-green-500 !border-green-500/50 text-white hover:!bg-green-600";
    }
    return "bg-muted/80 border-border/80 text-muted-foreground hover:bg-muted vowel-mic-inactive-glow";
  };

  return (
    <button
      type="button"
      onClick={toggleSession}
      disabled={isDisabled}
      title={getTitle()}
      aria-label={state.isConnected ? "Stop voice session" : "Start voice session"}
      data-active={state.isConnected}
      className={cn(
        "size-9 shrink-0 rounded-md px-0 flex items-center justify-center border transition-colors",
        getStatusStyles(),
        isDisabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {getIcon()}
    </button>
  );
}
