import { io } from "socket.io-client";

const URL = "https://paralleldev.onrender.com";
const ROOM = "load-room";

const createUser = (id) => {
  const socket = io(URL, {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log(`User ${id} connected`);

    socket.emit("join", {
      roomId: ROOM,
      userName: `USER_${id}`,
    });

    // spam compile requests
    let count = 0;

    const interval = setInterval(() => {
      if (count >= 5) {
        clearInterval(interval);
        return;
      }

      socket.emit("compileCode", {
        roomId: ROOM,
        code: `console.log("USER_${id} RUN ${count}")`,
        language_id: 63,
        input: "",
      });

      count++;
    }, 500);
  });

  socket.on("codeResponse", (data) => {
    console.log(`USER_${id} GOT:`, data.stdout);
  });

  return socket;
};

// create 10 users
for (let i = 1; i <= 10; i++) {
  setTimeout(() => createUser(i), i * 200);
}