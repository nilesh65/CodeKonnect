import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import axios from "axios";
import mongoose from "mongoose";
import dotenv from "dotenv";

import Room from "./models/Room.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

/* ---------------- MONGODB ---------------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

/* ---------------- TEMPLATES ---------------- */
const templates = {
  javascript: `// JavaScript Starter
function main() {
  console.log("Hello World");
}
main();
`,
  python: `# Python Starter
def main():
    print("Hello World")

main()
`,
  java: `// Java Starter
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
`,
  cpp: `// C++ Starter
#include <bits/stdc++.h>
using namespace std;

int main() {
    cout << "Hello World" << endl;
    return 0;
}
`,
};

/* ---------------- MEMORY ---------------- */
const rooms = new Map();
const executionQueues = new Map();
const saveTimers = new Map();

/* ---------------- TIMEOUT WRAPPER ---------------- */
const runWithTimeout = (promise, ms = 10000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), ms)
    ),
  ]);
};

/* ---------------- QUEUE PROCESSOR ---------------- */
const processRoomQueue = async (roomId) => {
  const queue = executionQueues.get(roomId);
  if (!queue || queue.length === 0) return;

  const job = queue.shift();

  try {
    const response = await runWithTimeout(
      axios.post(
        "https://ce.judge0.com/submissions?base64_encoded=false&wait=true",
        {
          source_code: job.code,
          language_id: job.language_id,
          stdin: job.input,
        }
      ),
      10000 // 10 sec timeout
    );

    io.to(roomId).emit("codeResponse", response.data);
  } catch (err) {
    io.to(roomId).emit("codeResponse", {
      error:
        err.message === "TIMEOUT"
          ? "Execution Timeout (10s exceeded)"
          : "Execution Failed",
    });
  }

  // continue queue safely
  if (queue.length > 0) {
    setImmediate(() => processRoomQueue(roomId));
  }
};

/* ---------------- SOCKET ---------------- */
io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  /* ---------------- JOIN ---------------- */
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

    io.to(roomId).emit(
      "userJoined",
      Array.from(room.users)
    );
  });

  /* ---------------- CODE ---------------- */
  socket.on("codeChange", ({ roomId, code }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.codes[room.activeLanguage] = code;

    socket.to(roomId).emit("codeUpdate", code);

    if (saveTimers.has(roomId)) {
      clearTimeout(saveTimers.get(roomId));
    }

    const timer = setTimeout(async () => {
      try {
        await Room.findOneAndUpdate(
          { roomId },
          {
            activeLanguage: room.activeLanguage,
            codes: room.codes,
          }
        );
      } catch (err) {
        console.log(err.message);
      }

      saveTimers.delete(roomId);
    }, 2000);

    saveTimers.set(roomId, timer);
  });

  /* ---------------- LANGUAGE ---------------- */
  socket.on("languageChange", ({ roomId, language }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.activeLanguage = language;

    io.to(roomId).emit("languageUpdate", language);
    io.to(roomId).emit("codeUpdate", room.codes[language]);
  });

  /* ---------------- EXECUTION ---------------- */
  socket.on("compileCode", ({ roomId, code, language_id, input }) => {
    if (!executionQueues.has(roomId)) {
      executionQueues.set(roomId, []);
    }

    const queue = executionQueues.get(roomId);

    queue.push({
      code,
      language_id,
      input,
    });

    if (queue.length === 1) {
      processRoomQueue(roomId);
    }
  });

  /* ---------------- LEAVE ---------------- */
  socket.on("leaveRoom", () => {
    if (currentRoom && currentUser) {
      const room = rooms.get(currentRoom);

      if (room) {
        room.users.delete(currentUser);

        io.to(currentRoom).emit(
          "userJoined",
          Array.from(room.users)
        );
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

        io.to(currentRoom).emit(
          "userJoined",
          Array.from(room.users)
        );
      }
    }
  });
});

/* ---------------- SERVER ---------------- */
const port = process.env.PORT || 5000;
const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});