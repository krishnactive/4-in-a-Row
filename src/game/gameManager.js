import { v4 as uuidv4 } from "uuid";
import { GameRepo } from "../persistence/gamesRepo.js";
import { LeaderboardRepo } from "../persistence/leaderboardRepo.js";
import { sessionManager } from "./sessionManager.js";
import { sendEvent } from "../kafka/producer.js";

export const gameManager = {
  games: new Map(),

  startGame(io, socketA, socketB, vsBot = false) {
    const gameId = uuidv4();
    const board = Array.from({ length: 6 }, () => Array(7).fill(0));

    const playerA = {
      id: socketA?.id ?? `P_${gameId}_A`,
      socket: socketA,
      data: { username: socketA?.data?.username ?? "PlayerA" },
    };

    const game = {
      id: gameId,
      board,
      players: [playerA],
      turn: 0,
      vsBot,
      moves: [],
      startTime: Date.now(),
    };

    if (vsBot) {
      const bot = { id: "BOT", socket: null, data: { username: "Bot" } };
      game.players.push(bot);

      playerA.socket.join(gameId);
      playerA.socket.emit("match_found", {
        gameId,
        opponent: "Bot",
        turn: 0,
      });
      playerA.socket.emit("turn_update", { yourTurn: true });

      //mark user as in-game immediately
      sessionManager.setInGame(playerA.data.username, gameId).catch(console.error);
    } else {
      const playerB = {
        id: socketB?.id ?? `P_${gameId}_B`,
        socket: socketB,
        data: { username: socketB?.data?.username ?? "PlayerB" },
      };
      game.players.push(playerB);

      // both join same room
      playerA.socket.join(gameId);
      playerB.socket.join(gameId);

      playerA.socket.emit("match_found", {
        gameId,
        opponent: playerB.data.username,
        turn: 0,
      });
      playerB.socket.emit("match_found", {
        gameId,
        opponent: playerA.data.username,
        turn: 1,
      });

      playerA.socket.emit("turn_update", { yourTurn: true });
      playerB.socket.emit("turn_update", { yourTurn: false });

      //mark both as in-game
      sessionManager.setInGame(playerA.data.username, gameId).catch(console.error);
      sessionManager.setInGame(playerB.data.username, gameId).catch(console.error);
    }

    this.games.set(gameId, game);
    console.log(`Game started ${gameId} (vsBot=${vsBot})`);

    // Kafaka event: game_started
    try {
      sendEvent({
        type: "game_started",
        gameId,
        players: game.players.map((p) => p.data?.username ?? "Bot"),
        vsBot,
      });
    } 
    catch (err) {
      console.error("[Kafka] sendEvent(game_started) failed:", err?.message ?? err);
    }

    return gameId;
  },

  async handleMove(io, gameId, socketId, column) {
    const game = this.games.get(gameId);
    if (!game) return console.warn(`[GameManager] ${gameId} not found`);

    const playerIndex = game.players.findIndex((p) => p.id === socketId || p.socket?.id === socketId);
    if (playerIndex === -1) return console.warn(`[GameManager] invalid player`);
    if (playerIndex !== game.turn) return;
    if (column < 0 || column > 6) return;

    const row = this._dropDisc(game.board, column, playerIndex + 1);
    if (row === -1) {
      game.players[playerIndex].socket?.emit("invalid_move", { reason: "Column full" });
      return;
    }

    game.moves.push({
      player: game.players[playerIndex].data?.username,
      column,
      row,
      time: new Date().toISOString(),
    });

    console.log(
      `[GameManager] ${game.id}: ${game.players[playerIndex].data.username} → col ${column}, row ${row}`
    );

    // Kafka: move_made
    try {
      sendEvent({
        type: "move_made",
        gameId,
        player: game.players[playerIndex].data?.username ?? "Bot",
        column,
        row,
        moveNumber: game.moves.length,
      });
    } catch (err) {
      console.error("[Kafka] sendEvent(move_made) failed:", err?.message ?? err);
    }

    const val = playerIndex + 1;
    const win = this._checkWin(game.board, val);
    const draw = this._isDraw(game.board);

    io.to(gameId).emit("game_update", { board: game.board });

    if (win || draw) {
      const winner =
        win && !draw
          ? game.players[playerIndex].data?.username
          : draw
          ? "Draw"
          : "Unknown";

      io.to(gameId).emit("game_over", { winner });
      await this._saveResult(game, winner);

      //Free player sessions BEFORE deleting game
      for (const p of game.players) {
        const username = p.data.username;
        if (username && username !== "Bot") {
          try {
            await sessionManager.setFree(username);
          } catch (err) {
            console.error("[Session] setFree error:", err.message);
          }
        }
      }

      this.games.delete(gameId);
      console.log(`[GameManager] Game ${gameId} completed`);

      // notify rematch available
      game.players.forEach((p) =>
        p.socket?.emit("rematch_available", {
          opponent: game.players.find((x) => x.data.username !== p.data.username)
            ?.data.username,
        })
      );
      return;
    }

    // Next turn
    game.turn = 1 - game.turn;
    game.players.forEach((p, i) =>
      p.socket?.emit("turn_update", { yourTurn: game.turn === i })
    );

    // Bot auto move
    if (game.vsBot && game.players[game.turn].id === "BOT") {
      setTimeout(() => this.botMove(io, gameId), 400);
    }
  },

  async _saveResult(game, winnerName) {
    const data = {
      player1: game.players[0].data?.username,
      player2: game.players[1].data?.username,
      winner: winnerName,
      status: "finished",
      duration_seconds: Math.floor((Date.now() - game.startTime) / 1000),
      total_moves: game.moves.length,
      moves: game.moves,
    };

    try {
      const saved = await GameRepo.saveGame(data);
      console.log(`[GameRepo] Game saved (${winnerName}) - id: ${saved?.id ?? saved}`);
    } catch (err) {
      console.error("[GameRepo] Error:", err.message);
    }

    try {
      sendEvent({
        type: "game_over",
        gameId: game.id,
        players: game.players.map((p) => p.data?.username ?? "Bot"),
        winner: winnerName,
        duration_seconds: Math.floor((Date.now() - game.startTime) / 1000),
        total_moves: game.moves.length,
      });
    } catch (err) {
      console.error("[Kafka] sendEvent(game_over) failed:", err?.message ?? err);
    }

    try {
      if (winnerName === "Draw" || winnerName === "Bot") return;
      const loser = game.players.find(
        (p) => p.data.username !== winnerName
      )?.data.username;

      await LeaderboardRepo.updateLeaderboard(winnerName, "win");
      if (loser && loser !== "Bot")
        await LeaderboardRepo.updateLeaderboard(loser, "loss");
    } catch (err) {
      console.error("[LeaderboardRepo] Error:", err.message);
    }
  },

  _dropDisc(board, col, val) {
    for (let r = 5; r >= 0; r--) {
      if (board[r][col] === 0) {
        board[r][col] = val;
        return r;
      }
    }
    return -1;
  },

  _checkWin(b, v) {
    const dirs = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        if (b[r][c] !== v) continue;
        for (const [dr, dc] of dirs) {
          let count = 0;
          for (let k = 0; k < 4; k++) {
            const nr = r + dr * k,
              nc = c + dc * k;
            if (nr < 0 || nr >= 6 || nc < 0 || nc >= 7 || b[nr][nc] !== v)
              break;
            count++;
          }
          if (count === 4) return true;
        }
      }
    }
    return false;
  },

  _isDraw(board) {
    return board.every((r) => r.every((c) => c !== 0));
  },

  async botMove(io, gameId) {
    const g = this.games.get(gameId);
    if (!g) return;

    const ROWS = 6, COLS = 7;
    const botVal = 2, humanVal = 1, DEPTH = 5; //can be used as level increaser changer

    const isValid = (b, c) => b[0][c] === 0;
    const getValidCols = (b) => [...Array(COLS).keys()].filter((c) => isValid(b, c));

    const dropPiece = (b, c, val) => {
      const temp = b.map((row) => [...row]);
      for (let r = ROWS - 1; r >= 0; r--) {
        if (temp[r][c] === 0) {
          temp[r][c] = val;
          return temp;
        }
      }
      return null;
    };

    const scoreWindow = (window, val) => {
      const oppVal = val === botVal ? humanVal : botVal;
      let score = 0;
      const countVal = (x) => window.filter((v) => v === x).length;
      const cb = countVal(val),
        co = countVal(oppVal),
        ce = countVal(0);
      if (cb === 4) score += 100;
      else if (cb === 3 && ce === 1) score += 10;
      else if (cb === 2 && ce === 2) score += 5;
      if (co === 3 && ce === 1) score -= 8;
      return score;
    };

    const evalBoard = (b, val) => {
      let s = 0;
      const centerArray = b.map((r) => r[Math.floor(COLS / 2)]);
      const centerCount = centerArray.filter((x) => x === val).length;
      s += centerCount * 3;

      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS - 3; c++)
          s += scoreWindow(b[r].slice(c, c + 4), val);
      for (let c = 0; c < COLS; c++)
        for (let r = 0; r < ROWS - 3; r++)
          s += scoreWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], val);
      for (let r = 0; r < ROWS - 3; r++)
        for (let c = 0; c < COLS - 3; c++)
          s += scoreWindow(
            [b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]],
            val
          );
      for (let r = 3; r < ROWS; r++)
        for (let c = 0; c < COLS - 3; c++)
          s += scoreWindow(
            [b[r][c], b[r - 1][c + 1], b[r - 2][c + 2], b[r - 3][c + 3]],
            val
          );
      return s;
    };

    const minimax = (b, depth, alpha, beta, max) => {
      const valCols = getValidCols(b);
      if (depth === 0 || !valCols.length) return [null, evalBoard(b, botVal)];

      if (max) {
        let val = -Infinity;
        let col = valCols[Math.floor(Math.random() * valCols.length)];
        for (const c of valCols) {
          const nb = dropPiece(b, c, botVal);
          if (this._checkWin(nb, botVal)) return [c, Infinity];
          const [, sc] = minimax(nb, depth - 1, alpha, beta, false);
          if (sc > val) {
            val = sc;
            col = c;
          }
          alpha = Math.max(alpha, val);
          if (alpha >= beta) break;
        }
        return [col, val];
      } else {
        let val = Infinity;
        let col = valCols[Math.floor(Math.random() * valCols.length)];
        for (const c of valCols) {
          const nb = dropPiece(b, c, humanVal);
          if (this._checkWin(nb, humanVal)) return [c, -Infinity];
          const [, sc] = minimax(nb, depth - 1, alpha, beta, true);
          if (sc < val) {
            val = sc;
            col = c;
          }
          beta = Math.min(beta, val);
          if (alpha >= beta) break;
        }
        return [col, val];
      }
    };

    const [col] = minimax(g.board, DEPTH, -Infinity, Infinity, true);
    const validCols = getValidCols(g.board);
    const move = col !== null && isValid(g.board, col)
      ? col
      : validCols[Math.floor(Math.random() * validCols.length)];
    await this.handleMove(io, gameId, "BOT", move);
  },

  async handleReconnect(io, username, socket) {
    for (const [gameId, game] of this.games.entries()) {
      const player = game.players.find((p) => p.data.username === username);
      if (player) {
        player.socket = socket;
        socket.join(gameId);
        socket.emit("rejoined", {
          gameId,
          board: game.board,
          yourTurn: game.turn === game.players.indexOf(player),
        });
        io.to(gameId).emit("player_rejoined", { username });
        console.log(`${username} rejoined ${gameId}`);
        return true;
      }
    }
    console.warn(`No active game found for ${username}`);
    return false;
  },

  async handleDisconnect(io, socketId) {
    for (const [gameId, g] of this.games.entries()) {
      const player = g.players.find((x) => x.id === socketId);
      if (!player) continue;
      const username = player.data.username;
      console.log(`${username} disconnected from ${gameId}`);
      await sessionManager.markDisconnected(username);

      const opponent = g.players.find((x) => x.id !== socketId);
      if (opponent?.id === "BOT") {
        io.to(gameId).emit("game_over", { winner: "Bot" });
        await sessionManager.setFree(username);
        this.games.delete(gameId);
        console.log(`Bot game ${gameId} ended because ${username} left`);
        return;
      }

      io.to(gameId).emit("player_disconnected", {
        username,
        message: "Opponent disconnected. Waiting 30s to reconnect...",
      });

      setTimeout(async () => {
        const s = sessionManager.active.get(username);
        if (!s || s.isLoggedIn === false) {
          io.to(gameId).emit("game_over", { winner: "Opponent forfeited" });
          for (const p of g.players) {
            if (p.data.username && p.data.username !== username)
              await sessionManager.setFree(p.data.username);
          }
          this.games.delete(gameId);
          console.log(`Game ${gameId} forfeited (${username} timeout)`);
        }
      }, 30000);
    }
  },
};
