import { pool } from "./db.js";

export const AnalyticsRepo = {

  async saveSnapshot(metrics) {
    try {
      const query = `
        INSERT INTO game_metrics
        (timestamp, total_games, avg_duration, most_frequent_winners, games_per_hour, user_stats)
        VALUES (NOW(), $1, $2, $3, $4, $5)
        RETURNING id;
      `;

      const values = [
        metrics.totalGames,
        metrics.avgDuration,
        JSON.stringify(metrics.mostFrequentWinners || {}),
        JSON.stringify(metrics.gamesPerHour || {}),
        JSON.stringify(metrics.userStats || {}),
      ];

      await pool.query(query, values);
      console.log("[AnalyticsRepo] Snapshot saved to DB");
    } catch (err) {
      console.error("[AnalyticsRepo] Error saving snapshot:", err.message);
    }
  },

  async getLatestSnapshot() {
    try {
      const result = await pool.query(
        `SELECT * FROM game_metrics ORDER BY timestamp DESC LIMIT 1;`
      );
      return result.rows[0] || null;
    } catch (err) {
      console.error("[AnalyticsRepo] Error fetching snapshot:", err.message);
      return null;
    }
  },
};
