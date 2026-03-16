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
const PENDING_MEMORY_SECTION_KEY = 'nerve:pending-memory-section';

function normalizeMemorySectionName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(memories|memory|section|show|me|the|list)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getMemoryItemsForSection(section: string): Promise<{ section: string; items: string[] } | null> {
  const res = await fetch('/api/memories');
  if (!res.ok) {
    throw new Error(`Failed to fetch memories: ${res.status}`);
  }

  const memories = await res.json() as Array<{ type?: string; text?: string }>;
  const normalizedTarget = normalizeMemorySectionName(section);
  let matchedSection: string | null = null;
  const items: string[] = [];
  let collecting = false;

  for (const memory of memories) {
    if (memory.type === 'section') {
      const text = typeof memory.text === 'string' ? memory.text.trim() : '';
      const normalizedSection = normalizeMemorySectionName(text);
      const isMatch = normalizedSection === normalizedTarget
        || normalizedSection.includes(normalizedTarget)
        || normalizedTarget.includes(normalizedSection);

      if (isMatch) {
        matchedSection = text;
        collecting = true;
        continue;
      }

      if (collecting) break;
      collecting = false;
      continue;
    }

    if (collecting && memory.type === 'item' && typeof memory.text === 'string' && memory.text.trim()) {
      items.push(memory.text.trim());
    }
  }

  if (!matchedSection) return null;
  return { section: matchedSection, items };
}

async function getMemorySectionContent(title: string, date?: string): Promise<string> {
  const params = new URLSearchParams({ title });
  if (date) params.set('date', date);

  const res = await fetch(`/api/memories/section?${params.toString()}`);
  const data = await res.json() as { ok?: boolean; content?: string; error?: string };

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Failed to load memory section: ${res.status}`);
  }

  return typeof data.content === 'string' ? data.content : '';
}

async function updateMemorySectionContent(title: string, content: string, date?: string): Promise<void> {
  const res = await fetch('/api/memories/section', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, date }),
  });
  const data = await res.json() as { ok?: boolean; error?: string };

  if (!res.ok || !data.ok) {
    throw new Error(data.error || `Failed to update memory section: ${res.status}`);
  }
}

function replaceMemoryLine(sectionContent: string, oldText: string, newText: string): { content: string; replaced: boolean } {
  const oldTrimmed = oldText.trim();
  const newTrimmed = newText.trim();
  const lines = sectionContent.split('\n');
  let replaced = false;

  const nextLines = lines.map((line) => {
    if (replaced) return line;

    const trimmedLine = line.trim();
    const bulletMatch = /^-\s+(.*)$/.exec(trimmedLine);
    const lineValue = bulletMatch ? bulletMatch[1].trim() : trimmedLine;

    if (lineValue !== oldTrimmed) return line;

    replaced = true;

    if (bulletMatch) {
      const indent = line.match(/^\s*/)?.[0] ?? '';
      return `${indent}- ${newTrimmed}`;
    }

    return newTrimmed;
  });

  return { content: nextLines.join('\n'), replaced };
}

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
- setChatDraft: Write text into the agent chat input without sending it
- sendChatDraft: Send whatever text is currently in the agent chat input
- sendMessage: Immediately send a text message to the AI agent for processing. Use this only when the user explicitly asks for an immediate send in the same utterance.
- switchView: Switch between 'chat' and 'kanban' views
- abortGeneration: Abort the currently running agent generation
- resetSession: Reset the current session to start fresh
- openSpawnAgent: Open the dialog to add/spawn a new agent or sub-agent
- openSettings: Open the settings drawer
- openWorkspacePanel: Open the workspace panel (mobile compact layout)
- switchWorkspaceTab: Navigate to a workspace tab: 'memory', 'crons', 'config', or 'kanban'
- switchConfigView: When on config tab, switch between 'files' and 'skills' sub-views
- openAddMemoryDialog: Open the add-memory dialog, but only when the user explicitly asks to open the dialog.
- addMemory: Add a memory with text (optional section). Prefer this over opening the dialog.
- requestMemoryDelete: Open the existing confirmation dialog for deleting a memory. Never delete memory silently.
- confirmMemoryDelete: Confirm the currently open memory delete dialog and perform the deletion.
- showMemorySection: Open the memory tab and expand a named memory section.
- getMemoriesInSection: Read the memories inside a named section such as "General".
- editMemory: Update an existing memory item inside a section.
- addTask: Create a kanban task with title (optional description)
- openAddCronDialog: Open the dialog to add a new cron job
- summarizeChat: Ask the agent to summarize the current conversation
- closeDialog: Close or cancel any open dialog (settings, spawn agent, add memory, add cron, create task, confirmations)

## How to Use:
- To stage a message for the agent without sending: Use setChatDraft
- To send the staged agent message: Use sendChatDraft when the user says "send it"
- To switch chat/kanban: Use switchView with 'chat' or 'kanban'
- To stop agent: Use abortGeneration
- To start fresh: Use resetSession
- To add an agent: Use openSpawnAgent
- To open settings: Use openSettings
- To show workspace: Use openWorkspacePanel (mobile) or switchWorkspaceTab to navigate tabs
- To add memory: Prefer addMemory directly whenever the user says what to remember. Only use openAddMemoryDialog when they explicitly ask to open the dialog.
- To delete memory: Use requestMemoryDelete so the UI asks for confirmation before deletion
- To confirm deletion: Use confirmMemoryDelete when the user says "yes", "confirm", "delete it", or similar while the delete dialog is open
- To show memories in a section: Use showMemorySection and getMemoriesInSection with the section name
- To edit a memory: Use editMemory with the section name, current memory text, and replacement text
- To add task: Use addTask with title and optional description
- To add cron: Use openAddCronDialog
- To summarize: Use summarizeChat
- To close any dialog: Use closeDialog (when user says "close", "cancel", "never mind")
- **DO NOT use DOM manipulation** unless explicitly required by user

## Memory — CRITICAL
When the user provides memory content in the same utterance, use addMemory directly. Do NOT open the add-memory dialog unless the user explicitly asks to open the dialog.

If the user asks to delete a memory, use requestMemoryDelete so the existing confirmation dialog opens first. Never delete memory without confirmation.

If the memory delete confirmation dialog is already open and the user confirms with "yes", "confirm", "delete it", or similar, use confirmMemoryDelete.

If the user asks to show or list memories inside a section, use showMemorySection to open and expand that section, and use getMemoriesInSection to read the items inside it.

If the user asks to edit or change a memory item, use editMemory with the section, the current item text, and the new item text.

Examples:
- "show me general memories" -> showMemorySection(section="General")
- "show me general memories" -> getMemoriesInSection(section="General")
- "show me the preferences memories" -> showMemorySection(section="Preferences")
- "show me the preferences memories" -> getMemoriesInSection(section="Preferences")
- "change the memory 'prefers dark roast' to 'prefers light roast' in General" -> editMemory(section="General", oldText="prefers dark roast", newText="prefers light roast")

## Agent Chat Drafting — CRITICAL
Do NOT type into or send the agent chat for ordinary conversation with the user.

Only write into the agent chat input when the user explicitly uses one of these lead-ins:
- "tell the agent to ..."
- "let's have the agent ..."
- "have the agent ..."

When one of those lead-ins is present:
- strip the lead-in
- call setChatDraft with the remainder
- do NOT send it yet unless the same utterance also clearly says "send it"

Only transmit the staged chat message when the user explicitly says "send it".
If the user says "send it", call sendChatDraft and do not rewrite the draft first unless they also dictated a replacement in the same utterance.

Do not use sendMessage for normal voice interactions. Prefer setChatDraft + sendChatDraft.

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
    description: 'Immediately send a text message to the AI agent for processing. Prefer setChatDraft and sendChatDraft for normal voice-controlled drafting.',
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

  vowel.registerAction('setChatDraft', {
    description: 'Write text into the current agent chat input without sending it. Use this only when the user explicitly says "tell the agent to", "let\'s have the agent", or "have the agent".',
    parameters: {
      message: { type: 'string', description: 'The draft message to place into the chat input' }
    }
  }, async ({ message }) => {
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) {
      return { success: false, error: 'Draft message is required' };
    }
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.CHAT_DRAFT_SET, {
      detail: { text, mode: 'replace', focus: true },
    }));
    return { success: true, message: 'Drafted message in chat input' };
  });

  vowel.registerAction('sendChatDraft', {
    description: 'Send the current contents of the agent chat input. Use this only when the user explicitly says "send it".',
    parameters: {}
  }, async () => {
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.CHAT_DRAFT_SEND));
    return { success: true, message: 'Sent drafted chat message' };
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
    description: 'Add a memory with the given text. Optionally specify a section. Prefer this over opening the add-memory dialog.',
    parameters: {
      text: { type: 'string', description: 'The memory content to add' },
      section: { type: 'string', description: 'Optional section name to place the memory under' }
    }
  }, async ({ text, section }) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return { success: false, error: 'Memory text is required' };
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

  vowel.registerAction('requestMemoryDelete', {
    description: 'Open the delete confirmation dialog for a memory. Use this when the user asks to delete a memory. Never delete directly without confirmation.',
    parameters: {
      text: { type: 'string', description: 'The memory text or section title to delete' },
      type: { type: 'string', description: 'Optional memory type: "item", "section", or "daily"' },
      date: { type: 'string', description: 'Optional date for daily memory entries' },
    }
  }, async ({ text, type, date }) => {
    const trimmedText = typeof text === 'string' ? text.trim() : '';
    if (!trimmedText) {
      return { success: false, error: 'Memory text is required to request deletion' };
    }

    const normalizedType = type === 'section' || type === 'daily' || type === 'item'
      ? type
      : 'item';

    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.OPEN_PANEL, { detail: { panel: 'workspace' } }));
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.WORKSPACE_TAB_CHANGE, { detail: { tab: 'memory' } }));
    [100, 300, 600].forEach((ms) => {
      setTimeout(() => window.dispatchEvent(new CustomEvent(NERVE_EVENTS.REQUEST_MEMORY_DELETE, {
        detail: {
          text: trimmedText,
          type: normalizedType,
          date: typeof date === 'string' ? date.trim() || undefined : undefined,
        },
      })), ms);
    });

    return { success: true, message: 'Opened memory delete confirmation' };
  });

  vowel.registerAction('confirmMemoryDelete', {
    description: 'Confirm the currently open memory delete dialog and perform the deletion. Use this only after the user explicitly confirms.',
    parameters: {}
  }, async () => {
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.CONFIRM_MEMORY_DELETE));
    return { success: true, message: 'Confirmed memory deletion' };
  });

  vowel.registerAction('getMemoriesInSection', {
    description: 'Read the memory items inside a named section such as "General".',
    parameters: {
      section: { type: 'string', description: 'The memory section name to inspect' },
    }
  }, async ({ section }) => {
    const trimmedSection = typeof section === 'string' ? section.trim() : '';
    if (!trimmedSection) {
      return { success: false, error: 'Section name is required' };
    }

    try {
      const result = await getMemoryItemsForSection(trimmedSection);
      if (!result) {
        return { success: false, error: `No memory section found for "${trimmedSection}"` };
      }
      return { success: true, section: result.section, items: result.items };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  vowel.registerAction('editMemory', {
    description: 'Update an existing memory item inside a named section. Use this when the user asks to edit or change a specific memory.',
    parameters: {
      section: { type: 'string', description: 'The memory section containing the item, such as "General"' },
      oldText: { type: 'string', description: 'The current memory text to replace' },
      newText: { type: 'string', description: 'The new memory text that should replace the current one' },
      date: { type: 'string', description: 'Optional date for daily memory files' },
    }
  }, async ({ section, oldText, newText, date }) => {
    const trimmedSection = typeof section === 'string' ? section.trim() : '';
    const trimmedOldText = typeof oldText === 'string' ? oldText.trim() : '';
    const trimmedNewText = typeof newText === 'string' ? newText.trim() : '';
    const trimmedDate = typeof date === 'string' ? date.trim() || undefined : undefined;

    if (!trimmedSection) {
      return { success: false, error: 'Section name is required' };
    }
    if (!trimmedOldText) {
      return { success: false, error: 'Current memory text is required' };
    }
    if (!trimmedNewText) {
      return { success: false, error: 'New memory text is required' };
    }

    try {
      const sectionResult = await getMemoryItemsForSection(trimmedSection);
      if (!sectionResult) {
        return { success: false, error: `No memory section found for "${trimmedSection}"` };
      }

      const exactItem = sectionResult.items.find((item) => item === trimmedOldText);
      const matchedItem = exactItem
        ?? sectionResult.items.find((item) => item.includes(trimmedOldText) || trimmedOldText.includes(item));

      if (!matchedItem) {
        return {
          success: false,
          error: `No memory matching "${trimmedOldText}" was found in section "${sectionResult.section}"`,
        };
      }

      const currentContent = await getMemorySectionContent(sectionResult.section, trimmedDate);
      const { content: nextContent, replaced } = replaceMemoryLine(currentContent, matchedItem, trimmedNewText);
      if (!replaced) {
        return {
          success: false,
          error: `Found the memory in "${sectionResult.section}" but could not update the section content`,
        };
      }

      await updateMemorySectionContent(sectionResult.section, nextContent, trimmedDate);
      window.dispatchEvent(new CustomEvent(NERVE_EVENTS.REFRESH_MEMORIES));

      return {
        success: true,
        message: `Updated memory in ${sectionResult.section}`,
        section: sectionResult.section,
        oldText: matchedItem,
        newText: trimmedNewText,
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  vowel.registerAction('showMemorySection', {
    description: 'Open the memory tab and expand a named memory section such as "General".',
    parameters: {
      section: { type: 'string', description: 'The memory section name to expand' },
    }
  }, async ({ section }) => {
    const trimmedSection = typeof section === 'string' ? section.trim() : '';
    if (!trimmedSection) {
      return { success: false, error: 'Section name is required' };
    }

    try {
      localStorage.setItem(PENDING_MEMORY_SECTION_KEY, trimmedSection);
    } catch {
      // ignore storage errors
    }

    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.OPEN_PANEL, { detail: { panel: 'workspace' } }));
    window.dispatchEvent(new CustomEvent(NERVE_EVENTS.WORKSPACE_TAB_CHANGE, { detail: { tab: 'memory' } }));
    [100, 300, 600, 1000].forEach((ms) => {
      setTimeout(() => window.dispatchEvent(new CustomEvent(NERVE_EVENTS.EXPAND_MEMORY_SECTION, {
        detail: { section: trimmedSection },
      })), ms);
    });

    return { success: true, message: `Opened memory section ${trimmedSection}` };
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
