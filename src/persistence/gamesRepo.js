import { pool } from "./db.js";
import { sendEvent } from "../kafka/producer.js";

export const GameRepo = {
  async saveGame(gameData) {
    console.log("[GameRepo] Saving game to DB:", gameData);
    const {
      player1,
      player2,
      winner,
      status,
      duration_seconds,
      total_moves,
      moves,
    } = gameData;

    const query = `
      INSERT INTO games (player1, player2, winner, status, duration_seconds, total_moves, moves)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;

    const values = [
      player1,
      player2,
      winner,
      status,
      duration_seconds,
      total_moves,
      JSON.stringify(moves),
    ];

    const result = await pool.query(query, values);
    const savedGame = result.rows[0];

    //Send Kafka event for analytics
    try {
      await sendEvent({
        type: "game_saved",
        gameId: savedGame.id,
        player1,
        player2,
        winner,
        duration_seconds,
        total_moves,
      });
      console.log(`[Kafka] Game saved event sent for ${savedGame.id}`);
    } catch (err) {
      console.error("[GameRepo] Kafka emit error:", err.message);
    }

    return savedGame;
  },

  async getRecentGames(limit = 10) {
    const query = `
      SELECT id, player1, player2, winner, status,
             duration_seconds, total_moves, created_at
      FROM games
      ORDER BY created_at DESC
      LIMIT $1;
    `;
    try {
      const result = await pool.query(query, [limit]);
      return result.rows;
    } catch (error) {
      console.error("[GameRepo] Error fetching recent games:", error.message);
      throw error;
    }
  },
};
