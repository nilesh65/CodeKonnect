# CodeKonnect 🚀

> **Real-time Collaborative Code Editor** — Write, run, and debug code together, live.

[![Node.js](https://img.shields.io/badge/Node.js-22.x-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-black?style=flat-square&logo=socket.io)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?style=flat-square&logo=mongodb)](https://mongodb.com/)
[![Deployed on Render](https://img.shields.io/badge/Deployed-Render-purple?style=flat-square)](https://render.com/)

🌐 **Live Demo:** [codekonnect.onrender.com](https://codekonnect.onrender.com)

---

## 📌 What is CodeKonnect?

CodeKonnect is a **production-grade, real-time collaborative IDE** that lets multiple developers write and execute code simultaneously in a shared room — like Google Docs, but for code.

- No login required — just create a room and share the ID
- Code syncs instantly across all connected devices
- Supports **JavaScript, Python, Java, C++** with real execution via Judge0
- Rooms persist in MongoDB — rejoin anytime and your code is still there

---

## ✨ Features

| Feature | Description |
|---|---|
| 👥 Real-time Collaboration | Multiple users edit the same code simultaneously |
| 🏠 Room System | Create/join rooms with unique IDs |
| 💻 Monaco Editor | VS Code's editor engine with syntax highlighting |
| ▶️ Code Execution | Real code runs via Judge0 API — not simulated |
| 📥 Stdin Support | Pass custom input to your programs |
| 🌐 Multi-language | JavaScript, Python, Java, C++ with starter templates |
| 💾 Persistence | Rooms and code saved in MongoDB |
| ⚡ Execution Queue | Concurrent run requests handled per room |
| ⏱️ Timeout Protection | Infinite loops killed after 10 seconds |
| 🔄 Auto Reconnect | Socket reconnects automatically on network drop |
| 🧑‍🤝‍🧑 User Presence | See who's in the room with colored avatars |
| ⌨️ Typing Indicator | See who is currently typing |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    React + Vite App                     │   │
│   │                                                         │   │
│   │   ┌──────────────┐        ┌────────────────────────┐   │   │
│   │   │ Monaco Editor│        │   Sidebar              │   │   │
│   │   │              │        │  - Room ID             │   │   │
│   │   │ (VS Code     │        │  - User List           │   │   │
│   │   │  Engine)     │        │  - Language Picker     │   │   │
│   │   └──────┬───────┘        │  - Typing Indicator    │   │   │
│   │          │                └────────────────────────┘   │   │
│   │   ┌──────▼───────────────────────────────────────────┐ │   │
│   │   │              Socket.IO Client                     │ │   │
│   │   │  Events: join | codeChange | compileCode |        │ │   │
│   │   │          languageChange | typing | leaveRoom      │ │   │
│   │   └──────────────────────┬───────────────────────────┘ │   │
│   └──────────────────────────│───────────────────────────── ┘   │
└──────────────────────────────│─────────────────────────────────-┘
                               │  WebSocket / HTTP Polling
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     SERVER (Render.com)                         │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │               Express + Socket.IO Server                │   │
│   │                                                         │   │
│   │  ┌──────────────────┐    ┌────────────────────────────┐ │   │
│   │  │  Socket.IO       │    │   Static File Server       │ │   │
│   │  │  Event Handlers  │    │   (serves React build)     │ │   │
│   │  │                  │    └────────────────────────────┘ │   │
│   │  │  - join          │                                   │   │
│   │  │  - codeChange    │    ┌────────────────────────────┐ │   │
│   │  │  - languageChange│    │   In-Memory Room Store     │ │   │
│   │  │  - compileCode   │    │   (Map)                    │ │   │
│   │  │  - typing        │    │                            │ │   │
│   │  │  - leaveRoom     │    │  roomId → {               │ │   │
│   │  │  - disconnect    │    │    users: Set,             │ │   │
│   │  └────────┬─────────┘    │    codes: {},              │ │   │
│   │           │              │    activeLanguage           │ │   │
│   │           │              │  }                         │ │   │
│   │  ┌────────▼─────────┐    └────────────────────────────┘ │   │
│   │  │  Execution Queue │                                   │   │
│   │  │  (per room)      │    ┌────────────────────────────┐ │   │
│   │  │                  │    │   Save Timer (Debounce)    │ │   │
│   │  │  FIFO queue →    │    │   2s debounce → MongoDB    │ │   │
│   │  │  processQueue()  │    │   write on codeChange      │ │   │
│   │  └────────┬─────────┘    └────────────┬───────────────┘ │   │
│   └───────────│───────────────────────────│─────────────────┘   │
└───────────────│───────────────────────────│─────────────────────┘
                │                           │
     ┌──────────▼──────────┐    ┌───────────▼──────────────┐
     │    Judge0 API        │    │     MongoDB Atlas         │
     │  (Code Execution)    │    │   (Room Persistence)      │
     │                      │    │                           │
     │  POST /submissions   │    │  Collection: rooms        │
     │  - source_code       │    │  - roomId                 │
     │  - language_id       │    │  - activeLanguage         │
     │  - stdin             │    │  - codes {}               │
     │  ← stdout/stderr     │    │  - timestamps             │
     │  10s timeout         │    └───────────────────────────┘
     └──────────────────────┘
```

---

## 🔄 Data Flow — How It Works

### 1. User Joins a Room
```
User enters roomId + userName
       ↓
Socket emits "join" event
       ↓
Server checks in-memory Map
       ↓ (room not found)
Server queries MongoDB
       ↓ (not in DB either)
Creates new Room document with starter templates
       ↓
Stores in Map + emits "userJoined", "codeUpdate", "languageUpdate" to room
```

### 2. Code Change (Real-time Sync)
```
User types in Monaco Editor
       ↓
handleCodeChange() fires
       ↓
Socket emits "typing" immediately → other users see typing indicator
       ↓
300ms debounce → Socket emits "codeChange"
       ↓
Server updates in-memory Map
       ↓
Broadcasts "codeUpdate" to all other users in room
       ↓
2000ms debounce → writes to MongoDB (prevents DB spam)
```

### 3. Code Execution
```
User clicks "Run"
       ↓
Socket emits "compileCode" { code, language_id, input }
       ↓
Server pushes job to room's execution queue
       ↓
processRoomQueue() picks job (FIFO)
       ↓
POST request to Judge0 API (10s timeout)
       ↓
Response (stdout/stderr) emitted to entire room via "codeResponse"
       ↓
All users in room see the output simultaneously
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool & dev server |
| Monaco Editor | Code editor (VS Code engine) |
| Socket.IO Client | Real-time communication |
| Lucide React | Icons |
| React Icons | Language icons |
| UUID | Room ID generation |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express | HTTP server |
| Socket.IO | WebSocket server |
| Mongoose | MongoDB ODM |
| Axios | Judge0 API calls |
| dotenv | Environment config |

### Infrastructure
| Service | Purpose |
|---|---|
| MongoDB Atlas | Room & code persistence |
| Judge0 API | Code execution engine |
| Render.com | Hosting (backend + frontend) |

---

## 📁 Project Structure

```
codekonnect/
├── backend/
│   ├── models/
│   │   └── Room.js          # Mongoose schema
│   ├── tests/
│   │   ├── judge0.test.js   # Judge0 API tests
│   │   ├── load.test.js     # Load testing (10 users)
│   │   └── queue.test.js    # Queue behavior tests
│   └── index.js             # Express + Socket.IO server
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main component
│   │   ├── App.css          # Styles
│   │   └── main.jsx         # React entry point
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── package.json             # Root — build + start scripts
└── .gitignore
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- Git

### 1. Clone the repo
```bash
git clone https://github.com/yourusername/codekonnect.git
cd codekonnect
```

### 2. Install dependencies
```bash
# Root dependencies (backend)
npm install

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 3. Create `.env` in root
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/codekonnect
PORT=5000
```

### 4. Create `frontend/.env`
```env
VITE_SERVER_URL=http://localhost:5000
```

### 5. Build frontend
```bash
cd frontend && npm run build && cd ..
```

### 6. Start server
```bash
npm start
```

Open [http://localhost:5000](http://localhost:5000) 🎉

### Development mode (with hot reload)
```bash
# Terminal 1 — Backend
npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

---

## 🌐 Deployment (Render)

### Environment Variables (Render Dashboard)
```
MONGO_URI = mongodb+srv://...
PORT      = 10000
NODE_ENV  = production
```

### Build Command
```bash
npm install && cd frontend && npm install && npm run build
```

### Start Command
```bash
node backend/index.js
```

---

## 🔌 Socket Events Reference

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `join` | `{ roomId, userName }` | Join a room |
| `codeChange` | `{ roomId, code }` | Broadcast code update |
| `languageChange` | `{ roomId, language }` | Switch language |
| `compileCode` | `{ roomId, code, language_id, input }` | Queue code execution |
| `typing` | `{ roomId, userName }` | Notify others of typing |
| `leaveRoom` | — | Leave current room |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `userJoined` | `string[]` | Updated user list |
| `codeUpdate` | `string` | Latest code from server |
| `languageUpdate` | `string` | Active language |
| `codeResponse` | `{ stdout, stderr, ... }` | Execution result |
| `userTyping` | `string` | Username of typer |

---

## 🧪 Testing

```bash
# Judge0 API connectivity
node backend/tests/judge0.test.js

# Queue behavior (2 users, 4 requests)
node backend/tests/queue.test.js

# Load test (10 simultaneous users)
node backend/tests/load.test.js
```

---

## 🔮 Roadmap

- [ ] Chat box inside rooms
- [ ] Cursor position sync (Google Docs style)
- [ ] Password-protected rooms
- [ ] Share code as GitHub Gist
- [ ] Video/voice chat integration
- [ ] Session replay

---

## 👨‍💻 Author

Built with ❤️ — a real-time collaborative IDE deployed on production and tested with 3+ simultaneous users.

> *"The best way to learn is to build something real."*