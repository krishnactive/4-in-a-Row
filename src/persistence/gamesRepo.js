import { pool } from "./db.js";

export const GameRepo = {
  async saveGame(gameData) {
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
    return result.rows[0];
  },
};
