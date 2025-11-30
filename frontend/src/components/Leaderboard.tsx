import React, { useEffect, useState } from 'react';
import { Trophy, ArrowLeft, Medal } from 'lucide-react';
import { nakamaService } from '../services/nakama';
import { LeaderboardEntry } from '../types/game';

interface LeaderboardProps {
  onBack: () => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await nakamaService.getLeaderboard();
      const formattedEntries = data.records.map((record: any, index: number) => ({
        userId: record.owner_id,
        username: record.username || `Player ${record.owner_id.substring(0, 5)}`,
        score: record.score,
        rank: index + 1
      }));
      setEntries(formattedEntries);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-white/50 font-bold">{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 max-w-2xl w-full shadow-2xl border border-white/20">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400" />
            <h2 className="text-3xl font-bold text-white">Leaderboard</h2>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="text-white/70 mt-4">Loading rankings...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/70">No rankings yet. Be the first to play!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.userId}
                className="bg-white/5 hover:bg-white/10 rounded-xl p-4 flex items-center gap-4 transition-all border border-white/10"
              >
                <div className="w-12 flex items-center justify-center">
                  {getRankIcon(entry.rank)}
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">{entry.username}</p>
                  <p className="text-white/50 text-sm">{entry.score} wins</p>
                </div>
                <div className="text-2xl font-bold text-white/90">
                  #{entry.rank}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;