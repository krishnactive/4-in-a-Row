import axios from "axios";

const API_URL = import.meta.env.VITE_BACKEND_URL;

export const getLeaderboard = async () => {
  const res = await axios.get(`${API_URL}/leaderboard`);
  return res.data;
};

export const getRecentGames = async () => {
  const res = await axios.get(`${API_URL}/games`);
  return res.data;
};
