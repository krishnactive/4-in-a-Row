import { pool } from "./db.js";

export const LeaderboardRepo = {
  async updateLeaderboard(player, result) {
    // result: "win" | "loss" | "draw"
    const colMap = {
      win: "wins",
      loss: "losses",
      draw: "draws",
    };

    const query = `
      INSERT INTO leaderboard (username, ${colMap[result]}, total_games, last_played)
      VALUES ($1, 1, 1, NOW())
      ON CONFLICT (username)
      DO UPDATE SET 
        ${colMap[result]} = leaderboard.${colMap[result]} + 1,
        total_games = leaderboard.total_games + 1,
        win_rate = CASE WHEN total_games + 1 > 0 THEN (wins::FLOAT / (total_games + 1)) * 100 ELSE 0 END,
        last_played = NOW();
    `;

    await pool.query(query, [player]);
  },
};
