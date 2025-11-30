import React from 'react';
import { Users, X } from 'lucide-react';

interface MatchmakingProps {
  onCancel: () => void;
}

const Matchmaking: React.FC<MatchmakingProps> = ({ onCancel }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 text-center relative">
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="animate-pulse mb-6">
          <Users className="w-16 h-16 text-white mx-auto" />
        </div>
        
        <h2 className="text-3xl font-bold text-white mb-4">Finding Opponent...</h2>
        <p className="text-white/70 mb-6">Please wait while we match you with a player</p>
        
        <div className="flex justify-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

export default Matchmaking;