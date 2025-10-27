import { matchmakingHandler } from "../matchmaking/matchmaking.js";
import { gameManager } from "../game/gameManager.js";
import { sessionManager } from "../game/sessionManager.js";

export const initSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join_game", async ({ username }) => {
      if (!username) return socket.emit("error_message", { message: "Username required" });

      //user idempotent
      if (socket.data?.username === username) {
        console.log(`[Socket] idempotent join for ${username}`);
        return matchmakingHandler(io, socket, username);
      }

      try {
        await sessionManager.register(username, socket.id, null);
      } catch (err) {
        if (err.message === "USERNAME_ACTIVE") {
          socket.emit("error_message", { message: "User already active elsewhere" });
          return;
        }
        console.error("[Socket] register error:", err.message);
        return;
      }

      socket.data = { username };
      await matchmakingHandler(io, socket, username);
    });

    //New: client should call start_new_game to ask for another match while still connected
    socket.on("start_new_game", async () => {
      const username = socket.data?.username;
      if (!username) return socket.emit("error_message", { message: "Not logged in" });

      //Ensure user is not already in a game
      const s = sessionManager.active.get(username);
      if (s?.isInGame) return socket.emit("error_message", { message: "You are already in a game" });

      await matchmakingHandler(io, socket, username);
    });

    socket.on("make_move", async ({ gameId, column }) => {
      await gameManager.handleMove(io, gameId, socket.id, column);
    });

    socket.on("reconnect_game", async ({ username }) => {
      if (!username) return;
      const gameId = await sessionManager.reconnect(username, socket.id);
      if (!gameId) return socket.emit("reconnect_failed", { message: "No active game found" });
      const ok = await gameManager.handleReconnect(io, username, socket);
      socket.emit(ok ? "rejoin_success" : "reconnect_failed", { gameId });
    });

    // Rematch handlers (same as we provided earlier)...
    socket.on("request_rematch", async ({ username, opponent }) => {
      if (!username || !opponent) return socket.emit("error_message", { message: "Invalid rematch request" });
      const oppSession = sessionManager.active.get(opponent);
      if (!oppSession || !oppSession.isLoggedIn) {
        return socket.emit("rematch_unavailable", { message: `${opponent} is not available` });
      }
      const oppSocket = io.sockets.sockets.get(oppSession.socketId);
      if (!oppSocket) return socket.emit("rematch_unavailable", { message: `${opponent} socket not reachable` });
      oppSocket.emit("rematch_request", { from: username });
    });

    socket.on("respond_rematch", async ({ from, to, accept }) => {
      if(!from || !to) return socket.emit("error_message", { message: "Invalid rematch response" });
      const fromSession = sessionManager.active.get(from);
      const toSession = sessionManager.active.get(to);
      if(!accept) {
        if (fromSession?.socketId) io.to(fromSession.socketId).emit("rematch_declined", { by: to });
        return;
      }
      if(!fromSession?.isLoggedIn || !toSession?.isLoggedIn) {
        return socket.emit("rematch_unavailable", { message: "Opponent not online" });
      }
      const activeFromGame = fromSession.isInGame && gameManager.games.has(fromSession.gameId);
const activeToGame = toSession.isInGame && gameManager.games.has(toSession.gameId);

if (activeFromGame || activeToGame) {
  socket.emit("rematch_unavailable", { message: "Opponent is still in a match" });
  return;
}

      const fromSocket = io.sockets.sockets.get(fromSession.socketId);
      const toSocket = io.sockets.sockets.get(toSession.socketId);
      if (!fromSocket || !toSocket) return socket.emit("rematch_unavailable", { message: "Must be connected" });
      const gameId = gameManager.startGame(io, fromSocket, toSocket, false);
      await sessionManager.setInGame(from, gameId);
      await sessionManager.setInGame(to, gameId);
      io.to(gameId).emit("rematch_started", { gameId });
    });

    socket.on("disconnect", async (reason) => {
      const username = socket.data?.username;
      console.log(`${username || "Unknown"} disconnected (${reason})`);
      if (username) await sessionManager.markDisconnected(username);
      await gameManager.handleDisconnect(io, socket.id);
    });
  });
};
