import React, { useState, useEffect } from 'react';
import { Home, Clock } from 'lucide-react';
import { GameState } from '../types/game';
import { nakamaService } from '../services/nakama';

interface GameProps {
  matchId: string;
  gameState: GameState;
  onLeave: () => void;
  currentUserId: string;
}

const Game: React.FC<GameProps> = ({ matchId, gameState, onLeave, currentUserId }) => {
  const [timeLeft, setTimeLeft] = useState(30);
  const currentPlayerMark = gameState.players[currentUserId]?.mark;
  const isMyTurn = gameState.currentPlayer === currentPlayerMark;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - gameState.turnStartTime;
      const remaining = Math.max(0, Math.floor((gameState.timePerTurn - elapsed) / 1000));
      setTimeLeft(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [gameState.turnStartTime, gameState.timePerTurn]);

  const handleCellClick = async (index: number) => {
    if (!isMyTurn || gameState.board[index] || gameState.winner) {
      return;
    }

    try {
      await nakamaService.sendMove(matchId, index);
    } catch (error) {
      console.error('Failed to send move:', error);
    }
  };

  const opponentInfo = Object.values(gameState.players).find(
    p => p.userId !== currentUserId
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 mb-4 flex items-center justify-between border border-white/20">
          <button
            onClick={onLeave}
            className="text-white/70 hover:text-white transition-colors"
          >
            <Home className="w-6 h-6" />
          </button>
          <div className="text-center">
            <p className="text-white/70 text-sm">Match ID: {matchId.substring(0, 8)}...</p>
            <p className="text-white font-semibold">
              vs {opponentInfo?.username || 'Waiting...'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-white">
            <Clock className="w-5 h-5" />
            <span className={`font-bold ${timeLeft < 10 ? 'text-red-400' : ''}`}>
              {timeLeft}s
            </span>
          </div>
        </div>

        {/* Game Board */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="mb-6 text-center">
            <p className="text-white/70 text-sm mb-2">Current Turn</p>
            <div className="inline-block bg-white/20 rounded-xl px-6 py-3">
              <span
                className={`text-4xl font-bold ${
                  gameState.currentPlayer === 'X' ? 'text-blue-400' : 'text-pink-400'
                }`}
              >
                {gameState.currentPlayer}
              </span>
            </div>
            {isMyTurn && !gameState.winner && (
              <p className="text-green-400 text-sm mt-2 font-semibold">Your turn!</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {gameState.board.map((cell, index) => (
              <button
                key={index}
                onClick={() => handleCellClick(index)}
                className={`aspect-square bg-white/20 rounded-2xl flex items-center justify-center text-6xl font-bold transition-all border-2 border-white/30 ${
                  isMyTurn && !cell && !gameState.winner
                    ? 'hover:bg-white/30 transform hover:scale-105 cursor-pointer'
                    : 'cursor-not-allowed'
                }`}
                disabled={!isMyTurn || !!cell || !!gameState.winner}
              >
                {cell && (
                  <span className={cell === 'X' ? 'text-blue-400' : 'text-pink-400'}>
                    {cell}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div
              className={`rounded-xl p-3 text-center border ${
                currentPlayerMark === 'X'
                  ? 'bg-blue-500/20 border-blue-500/50'
                  : 'bg-white/5 border-white/20'
              }`}
            >
              <p className="text-blue-400 font-bold text-sm mb-1">
                {currentPlayerMark === 'X' ? 'You (X)' : 'Opponent (X)'}
              </p>
              <p className="text-white text-xs">
                {currentPlayerMark === 'X' 
                  ? gameState.players[currentUserId]?.username 
                  : opponentInfo?.username}
              </p>
            </div>
            <div
              className={`rounded-xl p-3 text-center border ${
                currentPlayerMark === 'O'
                  ? 'bg-pink-500/20 border-pink-500/50'
                  : 'bg-white/5 border-white/20'
              }`}
            >
              <p className="text-pink-400 font-bold text-sm mb-1">
                {currentPlayerMark === 'O' ? 'You (O)' : 'Opponent (O)'}
              </p>
              <p className="text-white text-xs">
                {currentPlayerMark === 'O' 
                  ? gameState.players[currentUserId]?.username 
                  : opponentInfo?.username}
              </p>
            </div>
          </div>

          {gameState.winner && (
            <div className="mt-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 text-center">
              <p className="text-white font-bold text-xl">
                {gameState.winner === 'draw' 
                  ? "It's a Draw!" 
                  : gameState.winner === currentPlayerMark
                  ? 'You Win! 🎉'
                  : 'You Lose 😢'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Game;