import { pool } from "../persistence/db.js";

export const sessionManager = {
  active: new Map(),

  async register(username, socketId, gameId = null) {
    const existing = this.active.get(username);

    if (existing) {
      // If same socket re-registering (refresh or repeated join from same client) - allow
      if (existing.socketId === socketId) {
        existing.isLoggedIn = true;
        existing.lastSeen = Date.now();
        if (gameId) {
          existing.gameId = gameId;
          existing.isInGame = true;
        }
        await pool.query(
          `UPDATE sessions
           SET socket_id=$2, connected=TRUE, last_seen=NOW(), game_id=$3, in_game=$4
           WHERE username=$1`,
          [username, socketId, existing.gameId || gameId, !!(existing.isInGame || gameId)]
        );
        console.log(`[Session] Re-registered same socket for ${username}`);
        return;
      }

      // If existing logged in but not in-game and they try to register anew from another tab,
      // let them register too (allow starting new game) - but block if already in-game
      if (existing.isLoggedIn && !existing.isInGame) {
        // simply update socketId and treat as re-login (allows user to start new match)
        existing.socketId = socketId;
        existing.isLoggedIn = true;
        existing.lastSeen = Date.now();
        await pool.query(
          `UPDATE sessions SET socket_id=$2, connected=TRUE, last_seen=NOW() WHERE username=$1`,
          [username, socketId]
        );
        console.log(`[Session] Updated socket for logged-in idle user ${username}`);
        return;
      }

      // If they are logged in and in-game on another socket -> block duplicate login
      if (existing.isLoggedIn && existing.isInGame) {
        console.warn(`[Session] Duplicate login blocked for ${username}`);
        throw new Error("USERNAME_ACTIVE");
      }

      // If they are disconnected but within 30s grace -> reuse
      if (!existing.isLoggedIn && Date.now() - existing.lastSeen <= 30000) {
        clearTimeout(existing.timer);
        existing.socketId = socketId;
        existing.isLoggedIn = true;
        existing.lastSeen = Date.now();
        await pool.query(
          `UPDATE sessions SET socket_id=$2, connected=TRUE, last_seen=NOW() WHERE username=$1`,
          [username, socketId]
        );
        console.log(`[Session] Reused disconnected session for ${username}`);
        return;
      }

      // otherwise reset stale
      this.active.delete(username);
    }

    // New registration
    this.active.set(username, {
      socketId,
      gameId,
      isLoggedIn: true,
      isInGame: !!gameId,
      lastSeen: Date.now(),
      timer: null,
    });

    await pool.query(
      `INSERT INTO sessions (username, socket_id, game_id, connected, in_game, last_seen)
       VALUES ($1, $2, $3, TRUE, $4, NOW())
       ON CONFLICT (username)
       DO UPDATE SET socket_id=$2, game_id=$3, connected=TRUE, in_game=$4, last_seen=NOW()`,
      [username, socketId, gameId, !!gameId]
    );

    console.log(`[Session] Registered new user ${username}`);
  },

  async setInGame(username, gameId) {
    const s = this.active.get(username);
    if (s?.timer) {
      clearTimeout(s.timer);
      s.timer = null;
    }

    if (!s) {
      this.active.set(username, {
        socketId: null,
        gameId,
        isLoggedIn: false,
        isInGame: true,
        lastSeen: Date.now(),
        timer: null,
      });
    } else {
      s.gameId = gameId;
      s.isInGame = true;
      s.lastSeen = Date.now();
    }

    try {
      await pool.query(
        `UPDATE sessions SET game_id=$2, in_game=TRUE, last_seen=NOW() WHERE username=$1`,
        [username, gameId]
      );
    } catch (err) {
      console.error("[SessionManager] setInGame DB error:", err.message);
    }
  },

  async setFree(username) {
    const s = this.active.get(username);
    if (s) {
      s.isInGame = false;
      s.gameId = null;
      s.lastSeen = Date.now();
    }

    try {
      await pool.query(
        `UPDATE sessions SET game_id=NULL, in_game=FALSE, last_seen=NOW() WHERE username=$1`,
        [username]
      );
    } catch (err) {
      console.error("[SessionManager] setFree DB error:", err.message);
    }
  },

  async markDisconnected(username) {
    const s = this.active.get(username);
    if (!s) return;
    s.isLoggedIn = false;
    s.lastSeen = Date.now();

    try {
      await pool.query(
        `UPDATE sessions SET connected=FALSE, last_seen=NOW() WHERE username=$1`,
        [username]
      );
    } catch (err) {
      console.error("[SessionManager] markDisconnected DB error:", err.message);
    }

    clearTimeout(s.timer);
    s.timer = setTimeout(async () => {
      const tooLong = !s.isLoggedIn && Date.now() - s.lastSeen >= 30000;
      if (tooLong) {
        this.active.delete(username);
        try {
          await pool.query(`DELETE FROM sessions WHERE username=$1`, [username]);
        } catch (err) {
          console.error("[SessionManager] delete DB error:", err.message);
        }
        console.log(`[Session] Cleared session for ${username} after timeout`);
      }
    }, 30000);
  },

  async reconnect(username, socketId) {
    const s = this.active.get(username);
    if (!s) return null;

    if (Date.now() - s.lastSeen > 30000) {
      this.active.delete(username);
      return null;
    }

    clearTimeout(s.timer);
    s.socketId = socketId;
    s.isLoggedIn = true;
    s.lastSeen = Date.now();

    try {
      await pool.query(
        `UPDATE sessions SET connected=TRUE, socket_id=$2, last_seen=NOW() WHERE username=$1`,
        [username, socketId]
      );
    } catch (err) {
      console.error("[SessionManager] reconnect DB error:", err.message);
    }

    return s.gameId;
  },

  getGame(username) {
    const s = this.active.get(username);
    if (!s || !s.isInGame) return null;
    return s.gameId;
  },
};
