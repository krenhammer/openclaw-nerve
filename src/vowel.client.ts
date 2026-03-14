import { Vowel } from '@vowel.to/client';
import { NERVE_EVENTS } from '@/lib/constants';

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
let openSpawnAgentHandler: (() => void) | null = null;
let openSettingsHandler: (() => void) | null = null;

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

export function setOpenSpawnAgentHandler(handler: () => void) {
  openSpawnAgentHandler = handler;
}

export function setOpenSettingsHandler(handler: () => void) {
  openSettingsHandler = handler;
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
    instructions: `You are a voice assistant for vowel | Nerve, the web interface for OpenClaw AI agents.

## CRITICAL: Write to App Store, Not DOM
**MOST IMPORTANT RULE**: When performing actions, you MUST write to the application store/state management system, NOT manipulate the DOM directly. Always use registered actions that modify the app state. The UI will automatically update to reflect state changes.

## CRITICAL: Always Refer to Context for Information
Before answering ANY question or performing ANY action, ALWAYS check the <context> section for current information. The context contains the most up-to-date state of the application.

## Current Application State:
The current state is automatically provided in the <context> section. You always have access to the latest state - no need to call any actions to read it.

## About vowel | Nerve
vowel | Nerve is a web UI for OpenClaw AI agents. It provides:
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
- openSpawnAgent: Open the dialog to add/spawn a new agent or sub-agent
- openSettings: Open the settings drawer
- openWorkspacePanel: Open the workspace panel (mobile compact layout)
- switchWorkspaceTab: Navigate to a workspace tab: 'memory', 'crons', 'config', or 'kanban'
- switchConfigView: When on config tab, switch between 'files' and 'skills' sub-views
- openAddMemoryDialog: Open the add-memory dialog. Use when user wants to add a memory but has NOT yet stated what to remember.
- addMemory: Add a memory with text (optional section) — use ONLY when user provides the memory content in the same utterance
- addTask: Create a kanban task with title (optional description)
- openAddCronDialog: Open the dialog to add a new cron job
- summarizeChat: Ask the agent to summarize the current conversation
- closeDialog: Close or cancel any open dialog (settings, spawn agent, add memory, add cron, create task, confirmations)

## How to Use:
- To chat: Use sendMessage with your message
- To switch chat/kanban: Use switchView with 'chat' or 'kanban'
- To stop agent: Use abortGeneration
- To start fresh: Use resetSession
- To add an agent: Use openSpawnAgent
- To open settings: Use openSettings
- To show workspace: Use openWorkspacePanel (mobile) or switchWorkspaceTab to navigate tabs
- To add memory: Use openAddMemoryDialog when user says "add a memory", "I would like to add memory", "I want to add a memory", etc. without stating what to remember; use addMemory only when they say the content (e.g. "remember that X")
- To add task: Use addTask with title and optional description
- To add cron: Use openAddCronDialog
- To summarize: Use summarizeChat
- To close any dialog: Use closeDialog (when user says "close", "cancel", "never mind")
- **DO NOT use DOM manipulation** unless explicitly required by user

## Memory — CRITICAL
When the user expresses intent to add a memory (e.g. "add a memory", "I would like to add memory", "I want to add a memory", "add memory", "let me add a memory") but does NOT state the actual content to remember → call openAddMemoryDialog IMMEDIATELY. Do NOT ask "what would you like to remember?" — open the dialog so they can type it. Only use addMemory when the user explicitly states the memory content in the same utterance (e.g. "remember that my favorite color is blue").

When the user speaks to you, respond conversationally and help them interact with the vowel | Nerve application.`,
    
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
      showOnMobile: true
    },
    
    voiceConfig: {
      provider: 'vowel-prime',
      vowelPrimeConfig: { environment: 'staging' },
      llmProvider: 'groq',
      model: 'openai/gpt-oss-120b',
      voice: 'Timothy',
      language: 'en-US',
      /** Server-side VAD: no client model download, instant startup, integrated with streaming STT. */
      turnDetection: {
        mode: 'server_vad',
        // serverVAD: {
        //   threshold: 0.5,
        //   silenceDurationMs: 550,
        //   prefixPaddingMs: 0,
        //   interruptResponse: true,
        // },
      },
      useServerVad: true,
      initialGreetingPrompt: `Welcome to vowel | Nerve! I'm your voice assistant. I can help you chat with your OpenClaw agent, switch between chat and kanban views, add agents, memories, tasks, or crons, open settings, navigate workspace tabs, or summarize our conversation. You can also ask me to abort the current generation or reset your session. What would you like to do?`
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

  vowel.registerAction('openSpawnAgent', {
    description: 'Open the dialog to add or spawn a new agent or sub-agent',
    parameters: {}
  }, async () => {
    if (!openSpawnAgentHandler) {
      return { success: false, error: 'Spawn agent handler not initialized' };
    }
    openSpawnAgentHandler();
    return { success: true, message: 'Opened spawn agent dialog' };
  });

  vowel.registerAction('openSettings', {
    description: 'Open the settings drawer',
    parameters: {}
  }, async () => {
    if (!openSettingsHandler) {
      return { success: false, error: 'Settings handler not initialized' };
    }
    openSettingsHandler();
    return { success: true, message: 'Opened settings' };
  });

  vowel.registerAction('openWorkspacePanel', {
    description: 'Open the workspace panel (useful in mobile/compact layout)',
    parameters: {}
  }, async () => {
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.OPEN_PANEL, { detail: { panel: 'workspace' } }));
    return { success: true, message: 'Opened workspace panel' };
  });

  vowel.registerAction('switchWorkspaceTab', {
    description: 'Navigate to a workspace tab: memory, crons, config, or kanban',
    parameters: {
      tab: { type: 'string', description: 'The tab to switch to: "memory", "crons", "config", or "kanban"' }
    }
  }, async ({ tab }) => {
    const valid = ['memory', 'crons', 'config', 'kanban'];
    if (!valid.includes(tab)) {
      return { success: false, error: `Invalid tab. Must be one of: ${valid.join(', ')}` };
    }
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.WORKSPACE_TAB_CHANGE, { detail: { tab } }));
    return { success: true, message: `Switched to ${tab} tab` };
  });

  vowel.registerAction('switchConfigView', {
    description: 'When on the config tab, switch between files and skills sub-views',
    parameters: {
      view: { type: 'string', description: 'The sub-view: "files" or "skills"' }
    }
  }, async ({ view }) => {
    if (view !== 'files' && view !== 'skills') {
      return { success: false, error: 'Invalid view. Must be "files" or "skills"' };
    }
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.CONFIG_VIEW_CHANGE, { detail: { view } }));
    return { success: true, message: `Switched to ${view} view` };
  });

  /** Shared helper to open the add-memory dialog (used by openAddMemoryDialog and addMemory fallback). */
  function dispatchOpenAddMemoryDialog() {
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.OPEN_PANEL, { detail: { panel: 'workspace' } }));
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.WORKSPACE_TAB_CHANGE, { detail: { tab: 'memory' } }));
    // Fire OPEN_ADD_MEMORY at intervals so we catch MemoryList after it mounts (lazy load on compact)
    [100, 300, 600].forEach((ms) => {
      setTimeout(() => window.dispatchEvent(new CustomEvent(NERVE_EVENTS.OPEN_ADD_MEMORY)), ms);
    });
  }

  vowel.registerAction('addMemory', {
    description: 'Add a memory with the given text. Optionally specify a section. If no text provided, opens the add-memory dialog instead.',
    parameters: {
      text: { type: 'string', description: 'The memory content to add' },
      section: { type: 'string', description: 'Optional section name to place the memory under' }
    }
  }, async ({ text, section }) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
      console.log('[Vowel] addMemory called without text → opening add-memory dialog');
      dispatchOpenAddMemoryDialog();
      return { success: true, message: 'Opened add memory dialog' };
    }
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), section: section?.trim() || undefined, category: 'other' }),
      });
      const data = await res.json();
      if (!data.ok) {
        return { success: false, error: data.error || 'Failed to add memory' };
      }
      window.dispatchEvent(new CustomEvent(NERVE_EVENTS.REFRESH_MEMORIES));
      return { success: true, message: 'Memory added successfully' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  vowel.registerAction('addTask', {
    description: 'Create a new kanban task with the given title and optional description',
    parameters: {
      title: { type: 'string', description: 'The task title' },
      description: { type: 'string', description: 'Optional task description' }
    }
  }, async ({ title, description }) => {
    if (!title || typeof title !== 'string' || !title.trim()) {
      return { success: false, error: 'Task title is required' };
    }
    try {
      const res = await fetch('/api/kanban/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description?.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: body.details || body.error || `HTTP ${res.status}` };
      }
      window.dispatchEvent(new CustomEvent(NERVE_EVENTS.REFRESH_KANBAN));
      return { success: true, message: 'Task created successfully' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  vowel.registerAction('openAddCronDialog', {
    description: 'Open the dialog to add a new cron job',
    parameters: {}
  }, async () => {
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.OPEN_ADD_CRON));
    return { success: true, message: 'Opened add cron dialog' };
  });

  vowel.registerAction('openAddMemoryDialog', {
    description: 'Open the add-memory dialog. Call this when user says they want to add a memory (e.g. "add a memory", "I would like to add memory", "I want to add memory") but has NOT stated what to remember. Do NOT ask follow-up questions — open the dialog.',
    parameters: {}
  }, async () => {
    console.log('[Vowel] openAddMemoryDialog called');
    dispatchOpenAddMemoryDialog();
    return { success: true, message: 'Opened add memory dialog' };
  });

  vowel.registerAction('summarizeChat', {
    description: 'Ask the agent to summarize the current conversation',
    parameters: {}
  }, async () => {
    if (!sendMessageHandler) {
      return { success: false, error: 'Message handler not initialized' };
    }
    try {
      await sendMessageHandler('Please summarize our current conversation.');
      return { success: true, message: 'Asked the agent to summarize the chat' };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  vowel.registerAction('closeDialog', {
    description: 'Close or cancel any open dialog (settings, spawn agent, add memory, add cron, create task, confirmations). Use when user says "close", "cancel", "never mind", etc.',
    parameters: {}
  }, async () => {
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.CLOSE_DIALOG));
    return { success: true, message: 'Closed dialogs' };
  });
}

export function initializeVowel(appId: string) {
  if (!appId) return;
  vowelInstance = createVowelClient(appId);
  vowelInstance.updateContext(buildVowelContext());
  console.log('✅ Vowel client initialized with App ID:', appId);
  vowelChangeListeners.forEach(listener => listener(vowelInstance));
}

/** Clears the Vowel client (e.g. when user removes App ID in settings). */
export function clearVowel() {
  vowelInstance = null;
  vowelChangeListeners.forEach(listener => listener(null));
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
