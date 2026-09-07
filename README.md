# LiveConnect — Real-Time Messaging & LiveKit WebRTC Calling

LiveConnect is a full-stack, production-ready real-time communication web application featuring:

1. **One-to-One Text Messaging** (Supabase Auth, PostgreSQL, Supabase Realtime, and Row Level Security)
2. **One-to-One HD Audio Calling** (LiveKit Cloud WebRTC + Supabase Realtime Call Signaling)
3. **One-to-One HD Video Calling** (LiveKit Cloud WebRTC with remote stream, picture-in-picture local camera, camera toggle, and flip)

---

## 1. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Web Audio API Sound Synthesizer
- **Backend / API**: Express + Vite Dev Middleware / Node.js Server, LiveKit Server SDK
- **Database & Realtime**: Supabase (PostgreSQL 15+, Supabase Auth, Supabase Realtime CDC/Presence, RLS)
- **Audio & Video WebRTC**: LiveKit Cloud / LiveKit Server & `livekit-client` SDK

---

## 2. Supabase 7-Table Database Schema

The database is structured around exactly 7 application tables with full Row Level Security (RLS), constraints, foreign keys, triggers, and Realtime publications:

| Table | Description |
|---|---|
| `profiles` | User profile details, username, avatar, online status, and last seen |
| `conversations` | One-to-one conversation threads |
| `conversation_members` | Membership links mapping users to conversations |
| `messages` | Chat messages with timestamps and sender foreign keys |
| `message_reads` | Read receipts tracking when messages were seen |
| `calls` | Call signaling records (`audio`/`video`), room names, and status lifecycle |
| `call_participants` | Participant logs for call joins and leaves |

The full migration script is located at `/supabase/migrations/20260101000000_initial_schema.sql`.

---

## 3. Environment Variables

Create a `.env` file in the root directory (or use `.env.example` as a template):

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# LiveKit WebRTC Cloud Configuration
NEXT_PUBLIC_LIVEKIT_URL="wss://your-project.livekit.cloud"
LIVEKIT_API_KEY="APIxxxxxxxxxxxx"
LIVEKIT_API_SECRET="secret_xxxxxxxxxxxxxxxxxxxxxxxx"

# App Server
PORT=3000
APP_URL="http://localhost:3000"
```

> **Tip**: You can also configure credentials interactively inside the web application via the **Settings & Configuration Modal** without needing to restart the server.

---

## 4. Setup Instructions

### A. Supabase Setup
1. Create a free project at [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to the **SQL Editor** tab in Supabase.
3. Open `/supabase/migrations/20260101000000_initial_schema.sql` (or copy it from the in-app SQL Configuration tab) and execute it.
4. Go to **Project Settings** -> **API** and copy your **Project URL** and **anon public Key**.
5. Ensure Email Auth is enabled under **Authentication** -> **Providers** -> **Email**.

### B. LiveKit Setup
1. Create a free project at [LiveKit Cloud](https://cloud.livekit.io).
2. Copy your **WebSocket URL** (e.g. `wss://my-app.livekit.cloud`).
3. Generate an **API Key** and **API Secret** from the **Keys** tab in the LiveKit dashboard.
4. Add these into `.env` or the in-app Settings panel.

---

## 5. Running the Application

### Development Mode
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### Production Build
```bash
npm run build
npm run start
```

---

## 6. Testing & Validation

### 1. User Registration & Profile
- Open `http://localhost:3000`.
- Sign up as User A (`alex@example.com`, username: `alex`).
- In an Incognito tab or second browser, sign up as User B (`sarah@example.com`, username: `sarah`).

### 2. User Search & Real-Time Messaging
- From User A's screen, click the **New Chat / Search** button (+).
- Search for `@sarah` and click **Chat**.
- Send a message from User A. Notice how it appears immediately on User B's screen in real time with delivered and read status checkmarks.

### 3. Audio & Video Calling
- From User A's chat with User B, click the **Audio Call** or **Video Call** button.
- User A hears the ringback tone while waiting for answer.
- User B immediately receives a pop-up **Incoming Call Modal** with caller details, ringing chime, and Accept / Decline actions.
- When User B clicks **Accept**, both peers connect to the secure LiveKit room.
- Live WebRTC media stream is established with active duration timer, mute/unmute microphone, and camera flip/toggle controls.
- When either participant clicks **End Call**, the room disconnects and call state updates in Supabase.

---

## 7. Security Architecture

- **Token Security**: LiveKit tokens are securely minted on the server-side (`POST /api/livekit/token`) and never leak secrets to the client.
- **Row Level Security (RLS)**: Enforced across all 7 PostgreSQL tables so users can only access their own conversations, messages, and calls.
- **Microphone & Camera Privacy**: Media tracks are automatically stopped and detached immediately when calls terminate.
