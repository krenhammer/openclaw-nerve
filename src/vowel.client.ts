import { Vowel } from '@vowel.to/client';

export type ViewMode = 'chat' | 'kanban';

export interface AppState {
  viewMode: ViewMode;
  currentSession: string | null;
  sessions: Array<{ key: string; label: string }>;
  agentName: string;
  language: string;
  soundEnabled: boolean;
  wakeWordEnabled: boolean;
}

let vowelInstance: Vowel | null = null;

let appStateGetter: (() => AppState) | null = null;
let viewModeSetter: ((mode: ViewMode) => void) | null = null;
let sendMessageHandler: ((text: string) => Promise<void>) | null = null;
let abortHandler: (() => Promise<void>) | null = null;
let resetHandler: (() => void) | null = null;

type VowelChangeListener = (client: Vowel | null) => void;
const vowelChangeListeners = new Set<VowelChangeListener>();

export function setAppStateGetter(getter: () => AppState) {
  appStateGetter = getter;
}

export function setViewModeSetter(setter: (mode: ViewMode) => void) {
  viewModeSetter = setter;
}

export function setSendMessageHandler(handler: (text: string) => Promise<void>) {
  sendMessageHandler = handler;
}

export function setAbortHandler(handler: () => Promise<void>) {
  abortHandler = handler;
}

export function setResetHandler(handler: () => void) {
  resetHandler = handler;
}

function buildVowelContext(): Record<string, unknown> {
  const state = appStateGetter?.() ?? { viewMode: 'chat', currentSession: null, sessions: [], agentName: 'Agent', language: 'en', soundEnabled: true, wakeWordEnabled: false };
  return {
    app: {
      viewMode: state.viewMode,
      currentSession: state.currentSession,
      sessions: state.sessions,
      agentName: state.agentName,
      language: state.language,
      soundEnabled: state.soundEnabled,
      wakeWordEnabled: state.wakeWordEnabled,
    },
  };
}

function createVowelClient(appId: string): Vowel {
  const vowel = new Vowel({
    appId,
    instructions: `You are a voice assistant for Nerve, the web interface for OpenClaw AI agents.

## CRITICAL: Write to App Store, Not DOM
**MOST IMPORTANT RULE**: When performing actions, you MUST write to the application store/state management system, NOT manipulate the DOM directly. Always use registered actions that modify the app state. The UI will automatically update to reflect state changes.

## CRITICAL: Always Refer to Context for Information
Before answering ANY question or performing ANY action, ALWAYS check the <context> section for current information. The context contains the most up-to-date state of the application.

## Current Application State:
The current state is automatically provided in the <context> section. You always have access to the latest state - no need to call any actions to read it.

## About Nerve
Nerve is a web UI for OpenClaw AI agents. It provides:
- Voice conversations with the AI agent via chat
- Live workspace file editing with the agent
- Kanban task board for managing agent tasks
- Session management for main agent and sub-agents
- Real-time token usage and context monitoring

## Available Actions:
- getAppState: Get current app state including view mode, sessions, settings. Call this FIRST.
- sendMessage: Send a text message to the AI agent for processing
- switchView: Switch between 'chat' and 'kanban' views
- abortGeneration: Abort the currently running agent generation
- resetSession: Reset the current session to start fresh

## How to Use:
- To chat with the agent: Use sendMessage action with your message
- To switch views: Use switchView action with 'chat' or 'kanban'
- To stop agent: Use abortGeneration action
- To start fresh: Use resetSession action
- **DO NOT use DOM manipulation** unless explicitly required by user

When the user speaks to you, respond conversationally and help them interact with the Nerve application.`,
    
    floatingCursor: { enabled: false },
    
    borderGlow: {
      enabled: true,
      color: 'rgba(99, 102, 241, 0.5)',
      intensity: 30,
      pulse: true
    },

    _caption: {
      enabled: true,
      position: 'top-center',
      maxWidth: '600px',
      showRole: true,
      showOnMobile: false
    },
    
    voiceConfig: {
      provider: 'vowel-prime',
      vowelPrimeConfig: { environment: 'staging' },
      llmProvider: 'groq',
      model: 'openai/gpt-oss-120b',
      voice: 'Timothy',
      language: 'en-US',
      initialGreetingPrompt: `Welcome to Nerve! I'm your voice assistant. I can help you chat with your OpenClaw agent, switch between chat and kanban views, manage agent tasks, or answer questions about your workspace. You can also ask me to abort the current generation or reset your session. What would you like to do?`
    },
    
    onUserSpeakingChange: (isSpeaking) => {
      console.log(isSpeaking ? '🗣️ User started speaking' : '🔇 User stopped speaking');
    },
    onAIThinkingChange: (isThinking) => {
      console.log(isThinking ? '🧠 AI started thinking' : '💭 AI stopped thinking');
    },
    onAISpeakingChange: (isSpeaking) => {
      console.log(isSpeaking ? '🔊 AI started speaking' : '🔇 AI stopped speaking');
    },
  });

  registerCustomActions(vowel);
  return vowel;
}

function registerCustomActions(vowel: Vowel) {
  vowel.registerAction('getAppState', {
    description: 'Get current app state including view mode, sessions, settings. Call this FIRST when starting a new session to get the current context.',
    parameters: {},
  }, async () => {
    const state = buildVowelContext();
    return { success: true, ...state };
  });

  vowel.registerAction('sendMessage', {
    description: 'Send a text message to the AI agent for processing',
    parameters: {
      message: { type: 'string', description: 'The message to send to the agent' }
    }
  }, async ({ message }) => {
    if (!sendMessageHandler) {
      return { success: false, error: 'Message handler not initialized' };
    }
    try {
      await sendMessageHandler(message);
      return { success: true, message: 'Message sent successfully' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  vowel.registerAction('switchView', {
    description: 'Switch between chat and kanban views',
    parameters: {
      view: { type: 'string', description: 'The view to switch to: "chat" or "kanban"' }
    }
  }, async ({ view }) => {
    if (!viewModeSetter) {
      return { success: false, error: 'View mode setter not initialized' };
    }
    if (view !== 'chat' && view !== 'kanban') {
      return { success: false, error: 'Invalid view mode. Must be "chat" or "kanban"' };
    }
    viewModeSetter(view);
    return { success: true, message: `Switched to ${view} view` };
  });

  vowel.registerAction('abortGeneration', {
    description: 'Abort the currently running agent generation',
    parameters: {}
  }, async () => {
    if (!abortHandler) {
      return { success: false, error: 'Abort handler not initialized' };
    }
    try {
      await abortHandler();
      return { success: true, message: 'Generation aborted' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  vowel.registerAction('resetSession', {
    description: 'Reset the current session to start fresh with the agent',
    parameters: {}
  }, async () => {
    if (!resetHandler) {
      return { success: false, error: 'Reset handler not initialized' };
    }
    try {
      resetHandler();
      return { success: true, message: 'Session reset successfully' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}

export function initializeVowel(appId: string) {
  if (!appId) return;
  vowelInstance = createVowelClient(appId);
  vowelInstance.updateContext(buildVowelContext());
  console.log('✅ Vowel client initialized with App ID:', appId);
  vowelChangeListeners.forEach(listener => listener(vowelInstance));
}

export function getVowel(): Vowel | null {
  return vowelInstance;
}

export function subscribeToVowelChanges(listener: VowelChangeListener): () => void {
  vowelChangeListeners.add(listener);
  if (vowelInstance) {
    listener(vowelInstance);
  }
  return () => vowelChangeListeners.delete(listener);
}

export function updateVowelContext() {
  if (vowelInstance) {
    vowelInstance.updateContext(buildVowelContext());
  }
}

export type VowelClientType = Vowel | null;
