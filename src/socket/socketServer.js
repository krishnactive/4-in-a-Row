import { matchmakingHandler } from "../matchmaking/matchmaking.js";
import { gameManager } from "../game/gameManager.js";

export const initSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    //Player joins matchmaking queue
    socket.on("join_game", async ({ username }) => {
      matchmakingHandler(io, socket, username);
    });

    //Player makes a move
    socket.on("make_move", ({ gameId, column }) => {
      gameManager.handleMove(io, gameId, socket.id, column);
    });

    //Handle disconnection
    socket.on("disconnect", () => {
      gameManager.handleDisconnect(io, socket.id);
    });
  });
};
