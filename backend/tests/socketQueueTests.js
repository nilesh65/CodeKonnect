import { io } from "socket.io-client";

const URL = "https://paralleldev.onrender.com";

// simulate 2 users in same room
const userA = io(URL);
const userB = io(URL);

const roomId = "test-room";

let logs = [];

const join = (socket, name) => {
  socket.emit("join", {
    roomId,
    userName: name,
  });

  console.log(name, "joined");
};

userA.on("connect", () => join(userA, "USER_A"));
userB.on("connect", () => join(userB, "USER_B"));

// listen outputs
userA.on("codeResponse", (data) => {
  logs.push({ from: "A", data });
  console.log("A GOT OUTPUT:", data.stdout || data.error);
});

userB.on("codeResponse", (data) => {
  logs.push({ from: "B", data });
  console.log("B GOT OUTPUT:", data.stdout || data.error);
});

// run function
const runCode = (socket, label, delay = 0) => {
  setTimeout(() => {
    socket.emit("compileCode", {
      roomId,
      code: `console.log("${label}")`,
      language_id: 63,
      input: "",
    });

    console.log("RUN SENT:", label);
  }, delay);
};

// wait for connection then start test
setTimeout(() => {
  console.log("\n--- STARTING QUEUE TEST ---\n");

  runCode(userA, "FIRST", 0);
  runCode(userB, "SECOND", 50);
  runCode(userA, "THIRD", 100);
  runCode(userB, "FOURTH", 150);

}, 2000);