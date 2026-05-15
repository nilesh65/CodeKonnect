import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Room from "./models/Room.js";
import axios from "axios";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  },
  // ✅ Allow Render's proxy to handle transport
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

const templates = {
  javascript: `// JavaScript Starter\nfunction main() {\n  console.log("Hello World");\n}\nmain();\n`,
  python: `# Python Starter\ndef main():\n    print("Hello World")\n\nmain()\n`,
  java: `// Java Starter\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello World");\n    }\n}\n`,
  cpp: `// C++ Starter\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello World" << endl;\n    return 0;\n}\n`,
};

const rooms = new Map();
const executionQueues = new Map();
const saveTimers = new Map();

const runWithTimeout = (promise, ms = 10000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), ms)
    ),
  ]);

const processRoomQueue = async (roomId) => {
  const queue = executionQueues.get(roomId);
  if (!queue || queue.length === 0) return;

  const job = queue.shift();

  try {
    const response = await runWithTimeout(
      axios.post(
        "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
        { source_code: job.code, language_id: job.language_id, stdin: job.input }
      ),
      10000
    );
    io.to(roomId).emit("codeResponse", response.data);
  } catch (err) {
    io.to(roomId).emit("codeResponse", {
      error: err.message === "TIMEOUT" ? "Execution Timeout (10s exceeded)" : "Execution Failed",
    });
  }

  if (queue.length > 0) setImmediate(() => processRoomQueue(roomId));
};

io.on("connection", (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on("join", async ({ roomId, userName }) => {
    currentRoom = roomId;
    currentUser = userName;
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      let roomData = await Room.findOne({ roomId });
      if (!roomData) {
        roomData = await Room.create({
          roomId,
          activeLanguage: "javascript",
          codes: {
            javascript: templates.javascript,
            python: templates.python,
            java: templates.java,
            cpp: templates.cpp,
          },
        });
      }
      rooms.set(roomId, {
        users: new Set(),
        activeLanguage: roomData.activeLanguage,
        codes: roomData.codes,
      });
      executionQueues.set(roomId, []);
    }

    const room = rooms.get(roomId);
    room.users.add(userName);
    socket.emit("languageUpdate", room.activeLanguage);
    socket.emit("codeUpdate", room.codes[room.activeLanguage]);
    io.to(roomId).emit("userJoined", Array.from(room.users));
  });

  socket.on("codeChange", ({ roomId, code }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.codes[room.activeLanguage] = code;
    socket.to(roomId).emit("codeUpdate", code);

    if (saveTimers.has(roomId)) clearTimeout(saveTimers.get(roomId));
    const timer = setTimeout(async () => {
      try {
        await Room.findOneAndUpdate(
          { roomId },
          { activeLanguage: room.activeLanguage, codes: room.codes }
        );
      } catch (err) { console.log(err.message); }
      saveTimers.delete(roomId);
    }, 2000);
    saveTimers.set(roomId, timer);
  });

  socket.on("languageChange", ({ roomId, language }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.activeLanguage = language;
    io.to(roomId).emit("languageUpdate", language);
    io.to(roomId).emit("codeUpdate", room.codes[language]);
  });

  socket.on("compileCode", ({ roomId, code, language_id, input }) => {
    if (!executionQueues.has(roomId)) executionQueues.set(roomId, []);
    const queue = executionQueues.get(roomId);
    queue.push({ code, language_id, input });
    if (queue.length === 1) processRoomQueue(roomId);
  });

  socket.on("typing", ({ roomId, userName }) => {
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users.delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(room.users));
      }
    }
    socket.leave(currentRoom || "");
    currentRoom = null;
    currentUser = null;
  });

  socket.on("disconnect", () => {
    if (currentRoom && currentUser) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.users.delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(room.users));
      }
    }
  });
});

const port = process.env.PORT || 5000;
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/frontend/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});
// Health check — keeps Render from spinning down
app.get("/health", (req, res) => res.send("OK"));
server.listen(port, () => console.log(`Server running on port ${port}`));