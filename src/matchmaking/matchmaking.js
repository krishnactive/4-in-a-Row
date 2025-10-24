import { gameManager } from "../game/gameManager.js";

let waitingPlayer = null;

export const matchmakingHandler = (io, socket, username) => {
  socket.data.username = username;
  console.log(`${username} joined queue`);

  if (!waitingPlayer) {
    //No one waiting -> store & set timer for bot
    waitingPlayer = { socket, username };
    socket.emit("waiting", { message: "Waiting for opponent..." });

    setTimeout(() => {
      if (waitingPlayer && waitingPlayer.username === username) {
        console.log("Starting bot game for:", username);
        gameManager.startGame(io, socket, null, true);
        waitingPlayer = null;
      }
    }, 10_000);
  } else {
    // Someone is waiting -> start match
    const opponent = waitingPlayer;
    waitingPlayer = null;
    gameManager.startGame(io, socket, opponent.socket);
  }
};
