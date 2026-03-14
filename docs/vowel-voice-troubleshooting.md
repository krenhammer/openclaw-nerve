# Vowel Voice & Caption Troubleshooting

If the Vowel mic button isn’t acknowledging your voice or captions aren’t showing:

## 1. Vowel App ID

**Required.** Vowel must be initialized with a valid App ID.

- **Settings → Audio** → find the “Vowel App ID” field
- Set `VITE_VOWEL_APP_ID` in `.env` or enter the value in Settings
- If the mic button is hidden, the app ID is missing or invalid

## 2. Microphone permission

- Grant microphone access when the browser prompts
- If blocked, allow it in Settings → Site permissions for this origin
- Use HTTPS (or localhost) for microphone access

## 3. Start the session

- Click the mic button to start a voice session
- Wait until the button turns green (connected)
- Then speak; captions appear when speech is detected

## 4. Captions only appear when there's speech

- Captions show only after you speak and when the AI responds
- They show complete transcripts, not streaming text by default
- If you’re on mobile, captions are enabled by default (`showOnMobile: true`)

## 5. Browser console

- Open DevTools (F12) → Console
- Look for errors such as:
  - `Vowel client initialized with App ID:` — initialization succeeded
  - Microphone permission errors
  - Network / WebSocket errors

## 6. Network / connectivity

- Vowel uses a real-time connection to its servers
- Ensure no firewall or proxy is blocking WebSocket connections
- Check that you’re not behind a restrictive corporate network
