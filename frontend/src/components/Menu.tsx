import React from 'react';
import { Users, Trophy, Wifi, WifiOff, Play } from 'lucide-react';

interface MenuProps {
  connected: boolean;
  onFindMatch: () => void;
  onViewLeaderboard: () => void;
  stats: { wins: number; losses: number };
}

const Menu: React.FC<MenuProps> = ({ connected, onFindMatch, onViewLeaderboard, stats }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">Tic-Tac-Toe</h1>
          <p className="text-white/70">Multiplayer Edition</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6 text-white/90">
          {connected ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
          <span className="text-sm">
            {connected ? 'Connected to Server' : 'Connecting...'}
          </span>
        </div>

        <div className="bg-white/5 rounded-xl p-4 mb-6">
          <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Your Stats
          </h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-green-500/20 rounded-lg p-3">
              <p className="text-2xl font-bold text-green-400">{stats.wins}</p>
              <p className="text-white/70 text-sm">Wins</p>
            </div>
            <div className="bg-red-500/20 rounded-lg p-3">
              <p className="text-2xl font-bold text-red-400">{stats.losses}</p>
              <p className="text-white/70 text-sm">Losses</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={onFindMatch}
            disabled={!connected}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Find Match
          </button>

          <button
            onClick={onViewLeaderboard}
            disabled={!connected}
            className="w-full bg-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/20 transition-all border border-white/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            Leaderboard
          </button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-white/50 text-xs">Powered by Nakama Server</p>
        </div>
      </div>
    </div>
  );
};

export default Menu;