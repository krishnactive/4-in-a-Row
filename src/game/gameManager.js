import { v4 as uuidv4 } from "uuid";

export const gameManager = {
  games: new Map(),

  startGame(io, socketA, socketB, vsBot = false) {
    const gameId = uuidv4();
    const board = Array(6)
      .fill(null)
      .map(() => Array(7).fill(0));

    const game = {
      id: gameId,
      board,
      players: [socketA],
      turn: 0,
      vsBot,
    };

    if (vsBot) {
      game.players.push({ id: "BOT", username: "Bot" });
      socketA.emit("match_found", { gameId, opponent: "Bot", turn: 1 });
    } 
    else {
      game.players.push(socketB);
      game.players.forEach((s, i) =>
        s.emit("match_found", {
          gameId,
          opponent: game.players[1 - i].data.username,
          turn: i === 0 ? 1 : 0,
        })
      );
    }

    this.games.set(gameId, game);
  },

  handleMove(io, gameId, socketId, column) {
    const game = this.games.get(gameId);
    if (!game) return;

    const playerIndex = game.players.findIndex(
      (p) => p.id === socketId || p.socket?.id === socketId
    );
    if(playerIndex !== game.turn) return; 

    const row = this.dropDisc(game.board, column, playerIndex + 1);
    if(row === -1) return;

    const win = this.checkWin(game.board, playerIndex + 1);
    const draw = this.isDraw(game.board);

    io.to(gameId).emit("game_update", { board: game.board });

    if(win){
      io.to(gameId).emit("game_over", {
        winner: game.players[playerIndex].data?.username || "Bot",
      });
      this.games.delete(gameId);
    } 
    else if(draw){
      io.to(gameId).emit("game_over", { winner: "Draw" });
      this.games.delete(gameId);
    } 
    else{
      game.turn = 1 - game.turn;
      if (game.vsBot && game.turn === 1) {
        setTimeout(() => this.botMove(io, gameId), 500);
      }
    }
  },

  dropDisc(board, col, value) {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === 0) {
        board[row][col] = value;
        return row;
      }
    }
    return -1;
  },

  checkWin(b, v) {
    const R = 6,
      C = 7;
    const dir = [[1, 0],[0, 1],[1, 1],[1, -1],];
    for (let r = 0; r < R; r++)
      for (let c = 0; c < C; c++)
        if (b[r][c] === v)
          for (const [dr, dc] of dir){
            let cnt = 0;
            for (let k = 0; k < 4; k++) {
              const nr = r + dr * k,
                nc = c + dc * k;
              if (nr < 0 || nr >= R || nc < 0 || nc >= C || b[nr][nc] !== v)
                break;
              cnt++;
            }
            if (cnt === 4) return true;
          }
    return false;
  },

  isDraw(board) {
    return board.every((r) => r.every((c) => c !== 0));
  },

  botMove(io, gameId) {
    const game = this.games.get(gameId);
    if (!game) return;
    const validCols = [];
    for (let c = 0; c < 7; c++) if (game.board[0][c] === 0) validCols.push(c);

    const move = validCols[Math.floor(Math.random() * validCols.length)];
    this.handleMove(io, gameId, "BOT", move);
  },

  handleDisconnect(io, socketId) {
    for (const [id, g] of this.games.entries()) {
      if (g.players.some((p) => p.id === socketId)) {
        io.to(id).emit("game_over", { winner: "Opponent disconnected" });
        this.games.delete(id);
      }
    }
  },
};
