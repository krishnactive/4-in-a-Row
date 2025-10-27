import React from "react";

const GameBoard = ({ board, onMove, isMyTurn }) => {
  return (
    <div className="flex flex-col items-center mt-4">
      {board.map((row, rIdx) => (
        <div key={rIdx} className="flex">
          {row.map((cell, cIdx) => (
            <div
              key={cIdx}
              onClick={() => isMyTurn && onMove(cIdx)}
              className={`w-12 h-12 border-2 border-gray-400 rounded-full m-1 flex items-center justify-center cursor-pointer ${
                cell === 1 ? "bg-red-500" : cell === 2 ? "bg-yellow-400" : "bg-white"
              }`}
            ></div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default GameBoard;
