import React, { useEffect, useState } from "react";

const LeaderBoard = () => {
  const [leaders, setLeaders] = useState([]);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/leaderboard`);
      const data = await res.json();
      setLeaders(data);
    } catch (err) {
      console.error("Error fetching leaderboard:", err.message);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // auto-refresh leaderboard every 15 seconds
    const interval = setInterval(fetchLeaderboard, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!leaders.length)
    return <p className="text-gray-400 mt-4">🏆 No games played yet</p>;

  return (
    <div className="mt-6 mx-auto w-full max-w-md bg-white shadow-lg rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2 text-blue-600">🏅 Leaderboard</h3>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Rank</th>
            <th className="p-2 border">Player</th>
            <th className="p-2 border">Wins</th>
            <th className="p-2 border">Losses</th>
            <th className="p-2 border">Draws</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((p, i) => (
            <tr key={p.username} className="text-sm text-gray-700 text-center">
              <td className="border p-1">{i + 1}</td>
              <td className="border p-1">{p.username}</td>
              <td className="border p-1 font-semibold text-green-600">{p.wins}</td>
              <td className="border p-1 text-red-500">{p.losses}</td>
              <td className="border p-1 text-yellow-500">{p.draws}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LeaderBoard;
