import { gameManager } from "../game/gameManager.js";
import { sessionManager } from "../game/sessionManager.js";

let waitingPlayer = null;
const matchingLock = new Set();

export const matchmakingHandler = async (io, socket, username) => {
  if (matchingLock.has(username)) return;
  matchingLock.add(username);

  try {
    console.log(`${username} joined matchmaking`);

    const existingGameId = sessionManager.getGame(username);
    if (existingGameId) {
      const existingGame = gameManager.games.get(existingGameId);
      if (existingGame) {
        console.log(`${username} rejoining ${existingGameId}`);
        const ok = await gameManager.handleReconnect(io, username, socket);
        if (ok) {
          matchingLock.delete(username);
          return;
        } else {
          await sessionManager.setFree(username);
        }
      } else {
        await sessionManager.setFree(username);
      }
    }

    if (!waitingPlayer) {
      waitingPlayer = { socket, username };

      socket.once("disconnect", () => {
        if (waitingPlayer && waitingPlayer.username === username) {
          waitingPlayer = null;
          console.log(`[Matchmaking] Cleared waitingPlayer ${username} on disconnect`);
        }
      });

      socket.emit("waiting", { message: "Waiting for an opponent..." });

      setTimeout(async () => {
        if (waitingPlayer && waitingPlayer.username === username) {
          console.log(`starting bot for ${username}`);
          const gameId = gameManager.startGame(io, socket, null, true);
          waitingPlayer = null;
          await sessionManager.setInGame(username, gameId);
          socket.emit("game_started", { gameId, opponent: "Bot" });
        }
      }, 10000);
    } else {
      const opponent = waitingPlayer;
      waitingPlayer = null;
      const gameId = gameManager.startGame(io, opponent.socket, socket, false);

      await sessionManager.setInGame(username, gameId);
      await sessionManager.setInGame(opponent.username, gameId);

      opponent.socket.emit("game_started", { gameId, opponent: username });
      socket.emit("game_started", { gameId, opponent: opponent.username });
    }
  } catch (err) {
    console.error("[Matchmaking] error:", err.message);
  } finally {
    matchingLock.delete(username);
  }
};
