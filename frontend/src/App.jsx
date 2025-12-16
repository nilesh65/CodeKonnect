import { useEffect, useState, useRef } from "react";
import "./App.css";
import io from "socket.io-client";
import Editor from "@monaco-editor/react";
import { v4 as uuid } from "uuid";
import { Users, Copy, LogOut, Play, Code2, ChevronDown } from "lucide-react";
import { SiJavascript, SiPython, SiCplusplus } from "react-icons/si";
import { DiJava } from "react-icons/di";

// Connect to backend
const socket = io("https://codekonnect.onrender.com", {
  transports: ["websocket"],
});

const languages = [
  { value: "javascript", label: "JavaScript", icon: <SiJavascript color="#f7df1e" /> },
  { value: "python", label: "Python", icon: <SiPython color="#3776AB" /> },
  { value: "java", label: "Java", icon: <DiJava color="#007396" /> },
  { value: "cpp", label: "C++", icon: <SiCplusplus color="#00599C" /> },
];

const colors = ["#FF6B6B", "#6BCB77", "#4D96FF", "#FFD93D", "#9D4EDD", "#FF922B"];

const App = () => {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("// Start your code here ✨");
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState("");
  const [output, setOutput] = useState("");
  const [userInput, setUserInput] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const codeTimeout = useRef(null);

  useEffect(() => {
    socket.on("userJoined", setUsers);
    socket.on("codeUpdate", setCode);
    socket.on("languageUpdate", setLanguage);
    socket.on("userTyping", (u) => {
      setTyping(`${u.slice(0, 8)}... typing`);
      setTimeout(() => setTyping(""), 1200);
    });
    socket.on("codeResponse", (res) => {
      setOutput(res.run.output || "");
    });

    return () => socket.off();
  }, []);

  const joinRoom = () => {
    if (!roomId || !userName) return;
    socket.emit("join", { roomId, userName });
    setJoined(true);
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");
    setJoined(false);
    setRoomId("");
    setUserName("");
    setOutput("");
    setUserInput("");
  };

  const handleCodeChange = (val) => {
    setCode(val);
    socket.emit("typing", { roomId, userName });
    clearTimeout(codeTimeout.current);
    codeTimeout.current = setTimeout(() => {
      socket.emit("codeChange", { roomId, code: val });
    }, 300);
  };

  const runCode = () => {
    socket.emit("compileCode", {
      roomId,
      code,
      language,
      version: "*",
      input: userInput,
    });
  };

  const createRoomId = () => setRoomId(uuid());

  const copyRoomId = async () => {
    await navigator.clipboard.writeText(roomId);
    setCopySuccess("Copied!");
    setTimeout(() => setCopySuccess(""), 1500);
  };

  /* ---------------- LANDING PAGE ---------------- */
  if (!joined) {
    return (
      <div className="join-container landing">
        <div className="overlay">
          <div className="join-form">
            <h1>
              <Code2 size={36} /> CodeKonnect
            </h1>
            <p className="tagline">Collaborative Coding, Anytime, Anywhere</p>

            <input
              type="text"
              placeholder="Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button onClick={createRoomId}>
              <Users size={18} /> Create Room
            </button>

            <input
              type="text"
              placeholder="Your Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <button onClick={joinRoom}>
              <Users size={18} /> Join Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- EDITOR PAGE ---------------- */
  const currentLang = languages.find((l) => l.value === language);

  return (
    <div className="editor-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="room-info">
          <h2>Room</h2>
          <p>{roomId}</p>
          <button className="copy-button" onClick={copyRoomId}>
            <Copy size={16} /> Copy ID
          </button>
          {copySuccess && <span className="copy-success">{copySuccess}</span>}
        </div>

        <h3>
          <Users size={16} /> Users
        </h3>
        <ul className="users-list">
          {users.map((u, i) => (
            <li key={i} className="user-item">
              <div
                className="user-avatar"
                style={{ backgroundColor: colors[i % colors.length] }}
              >
                {u.charAt(0).toUpperCase()}
              </div>
              <span className="user-name">{u.slice(0, 12)}</span>
            </li>
          ))}
        </ul>

        <p className="typing-indicator">{typing}</p>

        {/* Custom Dropdown for Languages */}
        <div className="custom-dropdown">
          <div className="dropdown-header" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="lang-display">
              {currentLang.icon} <span>{currentLang.label}</span>
            </div>
            <ChevronDown size={18} />
          </div>
          {dropdownOpen && (
            <div className="dropdown-options">
              {languages.map((lang) => (
                <div
                  key={lang.value}
                  className="dropdown-item"
                  onClick={() => {
                    setLanguage(lang.value);
                    setDropdownOpen(false);
                    socket.emit("languageChange", { roomId, language: lang.value });
                  }}
                >
                  {lang.icon} <span>{lang.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="leave-button" onClick={leaveRoom}>
          <LogOut size={16} /> Leave
        </button>
      </aside>

      {/* Editor */}
      <main className="editor-wrapper">
        <Editor
          height="55%"
          theme="vs-dark"
          language={language}
          value={code}
          onChange={handleCodeChange}
          options={{ minimap: { enabled: false }, fontSize: 14 }}
        />

        <textarea
          className="input-console"
          placeholder="Input..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />

        <button className="run-btn" onClick={runCode}>
          <Play size={18} /> Run Code
        </button>

        <textarea
          className="output-console"
          value={output}
          readOnly
          placeholder="Output..."
        />
      </main>
    </div>
  );
};

export default App;
