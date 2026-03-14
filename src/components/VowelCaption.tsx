/**
 * VowelCaption – Real-time speech captions for the Vowel voice agent
 *
 * Displays user and AI speech as floating toast notifications.
 * Must be rendered inside VowelProvider.
 * Copied from @vowel.to/client for local control (no package source edits).
 */
import { useEffect, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { useVowel } from "@vowel.to/client/react";
import { cn } from "@/lib/utils";
import { useVowelCaptionManager } from "@/hooks/useVowelCaptionManager";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

export interface VowelCaptionProps {
  position?: "top-center" | "bottom-center";
  maxWidth?: string;
  /** @deprecated Kept for API compatibility */
  showRole?: boolean;
  className?: string;
}

export function VowelCaption({
  position = "top-center",
  maxWidth = "600px",
  showRole: _showRole = true,
  className,
}: VowelCaptionProps) {
  const { caption, dismissCaption } = useVowelCaptionManager();
  const { state, client } = useVowel();
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    const handleResize = () => setIsMobile(isMobileDevice());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const captionConfig = client?.getConfig()._caption;
  const showOnMobile = captionConfig?.showOnMobile ?? false;
  const shouldShow = !isMobile || showOnMobile;

  useEffect(() => {
    if (caption?.isVisible) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [caption?.isVisible]);

  useEffect(() => {
    if (!state.isConnected && caption?.isVisible) {
      dismissCaption();
    }
  }, [state.isConnected, caption?.isVisible, dismissCaption]);

  if (!caption || !isVisible || !shouldShow) {
    return null;
  }

  const positionClasses = {
    "top-center": "top-4 left-1/2 -translate-x-1/2",
    "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  };

  return (
    <div
      className={cn(
        "fixed z-[100] px-4 py-3 rounded-md shadow-2xl backdrop-blur-xl border",
        "transition-all duration-300 ease-in-out",
        "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        "bg-gray-900/95 text-gray-100 border-gray-700/50",
        "dark:bg-gray-800/95 dark:text-gray-100 dark:border-gray-600/50",
        positionClasses[position],
        className,
      )}
      style={{ maxWidth }}
      onClick={dismissCaption}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 relative">
          {caption.role === "user" ? (
            <MessageCircle className="w-4 h-4 text-gray-400" />
          ) : (
            <Sparkles className="w-4 h-4 text-gray-400" />
          )}
          {caption.isStreaming && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex-1 text-sm leading-relaxed break-words">
          {caption.text}
        </div>
      </div>
    </div>
  );
}
