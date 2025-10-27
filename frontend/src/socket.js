import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/,"")||"http://localhost:8080";

export const socket = io(BACKEND_URL, {
  transports: ["websocket"],
  reconnection: true,
});

// console.log("Socket connected to:", BACKEND_URL);
