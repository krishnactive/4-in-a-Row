import React, { useEffect, useState } from "react";
import { socket } from "./socket";
import UsernameForm from "./components/UsernameForm";
import GameBoard from "./components/GameBoard";
import LeaderBoard from "./components/LeaderBoard";

// React Icons
import {
  FaUser,
  FaSignOutAlt,
  FaSyncAlt,
  FaRedo,
  FaPlayCircle,
  FaHandshake,
  FaCrown,
} from "react-icons/fa";
import { AiOutlineWifi } from "react-icons/ai";
import { MdSignalWifiOff, MdReplayCircleFilled, MdError } from "react-icons/md";
import { GiTrophyCup } from "react-icons/gi";

function App() {
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [board, setBoard] = useState(Array.from({ length: 6 }, () => Array(7).fill(0)));
  const [gameId, setGameId] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [status, setStatus] = useState("Welcome! Please join a game.");
  const [opponent, setOpponent] = useState("");
  const [connected, setConnected] = useState(false);
  const [showRematch, setShowRematch] = useState(false);
  const [rematchRequest, setRematchRequest] = useState(null);

  // Auto reconnect if username exists
  useEffect(() => {
    const savedUser = localStorage.getItem("username");
    if (savedUser) socket.emit("reconnect_game", { username: savedUser });
  }, []);

  // SOCKET EVENTS
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to backend:", socket.id);
      setConnected(true);
      if (username) socket.emit("reconnect_game", { username });
    });

    socket.on("disconnect", () => {
      console.warn("Disconnected from server");
      setConnected(false);
      setStatus("Connection lost... Trying to reconnect");
    });

    socket.on("match_found", (data) => {
      setGameId(data.gameId);
      setOpponent(data.opponent);
      setIsMyTurn(data.turn === 0);
      setStatus(`Playing vs ${data.opponent}`);
      setBoard(Array.from({ length: 6 }, () => Array(7).fill(0)));
      setShowRematch(false);
    });

    socket.on("game_update", (data) => setBoard(data.board));
    socket.on("turn_update", (data) => setIsMyTurn(data.yourTurn));

    socket.on("game_over", (data) => {
      setStatus(` Winner: ${data.winner}`);
      setIsMyTurn(false);
      setShowRematch(true);
    });

    socket.on("rejoined", (data) => {
      setGameId(data.gameId);
      setBoard(data.board);
      setIsMyTurn(data.yourTurn);
      setStatus("Reconnected to your ongoing game");
    });

    socket.on("reconnect_failed", () => {
      setStatus("Reconnect failed — please start a new game");
      setGameId(null);
      setBoard(Array.from({ length: 6 }, () => Array(7).fill(0)));
    });

    socket.on("error_message", (data) => {
      alert(data.message || "An error occurred");
      setStatus("Error: " + (data.message || "Unknown error"));
    });

    socket.on("leaderboard_update", () =>
      setStatus((s) => s + " • Leaderboard updated")
    );

    socket.on("rematch_request", ({ from }) => setRematchRequest(from));
    socket.on("rematch_declined", ({ by }) => {
      alert(`${by} declined your rematch `);
      setShowRematch(false);
    });
    socket.on("rematch_unavailable", (data) => alert(data.message));
    socket.on("rematch_started", ({ gameId }) => {
      setGameId(gameId);
      setBoard(Array.from({ length: 6 }, () => Array(7).fill(0)));
      setIsMyTurn(true);
      setStatus("Rematch started!");
      setShowRematch(false);
      setRematchRequest(null);
    });

    return () => socket.removeAllListeners();
  }, [username]);

  // HANDLERS
  const handleJoin = (name) => {
    if (!name.trim()) return;
    setUsername(name);
    localStorage.setItem("username", name);
    setStatus("Searching for opponent...");
    socket.emit("join_game", { username: name });
  };

  const handleMove = (column) => {
    if (!gameId || !isMyTurn) return;
    socket.emit("make_move", { gameId, column });
    setIsMyTurn(false);
  };

  const handleReconnect = () => {
    if (!username) return alert("Enter username first");
    socket.emit("reconnect_game", { username });
    setStatus("Trying to reconnect...");
  };

  const handleRequestRematch = () => {
    socket.emit("request_rematch", { username, opponent });
    setStatus(`Sent rematch request to ${opponent}`);
  };

  const handleLogout = () => {
    if (socket.connected) socket.disconnect();
    localStorage.removeItem("username");
    setUsername("");
    setGameId(null);
    setOpponent("");
    setBoard(Array.from({ length: 6 }, () => Array(7).fill(0)));
    setStatus("Logged out. Please enter a new username.");
    setIsMyTurn(false);
    setShowRematch(false);
    setRematchRequest(null);
    setTimeout(() => {
      if (!socket.connected) socket.connect();
    }, 1000);
  };

  // UI
  return (
    <div className="text-center min-h-screen bg-linear-to-b from-white to-gray-100 py-8">
      {!username ? (
        <UsernameForm onJoin={handleJoin} />
      ) : (
        <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-md">
          <div className="flex justify-between items-center border-b pb-3 mb-4">
            <h1 className="text-2xl font-semibold text-blue-600 flex items-center gap-2">
              <FaUser /> {username}
            </h1>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              <FaSignOutAlt /> Logout
            </button>
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-semibold flex justify-center items-center gap-2">
              {status}
              {gameId && (
                <span className="text-gray-500 flex items-center gap-1">
                  {connected ? (
                    <AiOutlineWifi className="text-green-500" />
                  ) : (
                    <MdSignalWifiOff className="text-red-500" />
                  )}
                  {connected ? "Online" : "Offline"}
                </span>
              )}
            </h2>
          </div>

          {gameId && (
            <>
              <p className="text-lg mb-3 text-blue-600 flex items-center justify-center gap-2">
                {isMyTurn ? (
                  <>
                    <FaPlayCircle className="text-green-500" /> Your Turn
                  </>
                ) : (
                  <>
                    <FaPlayCircle className="text-gray-400" /> Opponent Turn
                  </>
                )}
              </p>
              <div className="flex justify-center mb-6">
                <GameBoard board={board} onMove={handleMove} isMyTurn={isMyTurn} />
              </div>
            </>
          )}

          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <button
              onClick={handleReconnect}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
            >
              <FaSyncAlt /> Reconnect
            </button>

            {(status.includes("Reconnect failed") ||
              status.includes("Winner") ||
              status.includes("Draw") ||
              status.includes("forfeited")) && (
              <button
                onClick={() => {
                  setBoard(Array.from({ length: 6 }, () => Array(7).fill(0)));
                  setGameId(null);
                  setIsMyTurn(false);
                  setStatus("Starting new game...");
                  socket.emit("join_game", { username });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                <FaRedo /> Start New Game
              </button>
            )}

            {showRematch && opponent && opponent!=='Bot'&& (
              <button
                onClick={handleRequestRematch}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
              >
                <MdReplayCircleFilled /> Rematch with {opponent}
              </button>
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center justify-center gap-2 mb-2">
              <GiTrophyCup className="text-yellow-500" /> Leaderboard
            </h3>
            <LeaderBoard key={status} />
          </div>

          {rematchRequest && (
            <div className="mt-8 p-5 bg-yellow-100 rounded-lg shadow-md max-w-sm mx-auto">
              <p className="font-semibold mb-3 flex items-center justify-center gap-2 text-yellow-700">
                <FaHandshake /> {rematchRequest} wants a rematch!
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    socket.emit("respond_rematch", {
                      from: rematchRequest,
                      to: username,
                      accept: true,
                    });
                    setRematchRequest(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  <FaCrown /> Accept
                </button>
                <button
                  onClick={() => {
                    socket.emit("respond_rematch", {
                      from: rematchRequest,
                      to: username,
                      accept: false,
                    });
                    setRematchRequest(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  <MdError /> Decline
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
