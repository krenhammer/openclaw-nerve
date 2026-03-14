# vowelbot Setup Guide

This repository has been set up with vowelbot — voice agent integration for your web project.

## Quick Start

### 1. API Keys (Optional)

vowelbot uses **OpenCode free models by default** — no API key required! The integration will automatically use the Minimax M2.5 free model.

**Want premium models?** Add one of these as a secret:

| Secret name | Where to get it |
|-------------|-----------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) — Claude models |
| `OPENAI_API_KEY` | [platform.openai.com](https://platform.openai.com) — GPT models |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) — Fast Llama models |
| `OPENCODE_API_KEY` | [opencode.ai/zen](https://opencode.ai/zen) — Use paid models with OpenCode credits |

**Note:** If you add any API key, vowelbot will use that provider instead of the free OpenCode models.

### 2. Run the Integration

Go to **Actions → vowelbot integration → Run workflow** to trigger the voice agent integration.

Or comment `/vowelbot integrate` in any issue or PR.

### 3. Review & Merge

OpenCode will create a PR with the voice agent changes. Review and merge to enable voice features.

### 4. Get Your App ID

Visit [vowel.to](https://vowel.to) to get your `VOWEL_APP_ID` and complete setup.

## Using vowelbot

After the initial integration, you can use vowelbot for ongoing voice agent improvements:

- **`/vowelbot integrate`** — Full voice agent setup
- **`/vowelbot add state sync for [feature]`** — Add state management
- **`/vowelbot enable [capability]`** — Enable voice features

### Skill routing by target stack

- **React/Next.js/TanStack Router/React Router** → `vowel-react`
- **Plain JavaScript (no framework)** → `vowel-vanilla`
- **Drop-in widget integration** → `vowel-webcomponent`

## Support

Having issues? Visit [add.vowel.to](https://add.vowel.to) for help.
