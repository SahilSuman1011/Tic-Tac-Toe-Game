export interface Player {
  userId: string;
  username: string;
  mark: 'X' | 'O';
}

export interface GameState {
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  players: { [userId: string]: Player };
  winner: string | null;
  startTime: number;
  turnStartTime: number;
  timePerTurn: number;
}

export interface MatchData {
  matchId: string;
  players: Player[];
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}