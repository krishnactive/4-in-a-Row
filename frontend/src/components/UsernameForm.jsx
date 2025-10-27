import React, { useState } from "react";

const UsernameForm = ({ onJoin }) => {
  const [username, setUsername] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) onJoin(username);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-4">🎮 4 in a Row</h1>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter your username"
        className="border p-2 rounded w-64 mb-3 text-center"
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Join Game
      </button>
    </form>
  );
};

export default UsernameForm;
