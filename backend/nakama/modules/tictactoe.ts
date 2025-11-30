// Nakama Server Module - Tic-Tac-Toe Game Logic
// This runs on the Nakama server and handles all game logic server-side

interface GameState {
  board: (string | null)[];
  currentPlayer: 'X' | 'O';
  players: { [userId: string]: { mark: 'X' | 'O'; userId: string; username: string } };
  winner: string | null;
  startTime: number;
  turnStartTime: number;
  timePerTurn: number;
}

interface MatchState {
  gameState: GameState;
}

const moduleName = "tictactoe";

const rpcCreateMatch: nkruntime.RpcFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const matchId = nk.matchCreate(moduleName, {});
  return JSON.stringify({ matchId });
};

const rpcFindMatch: nkruntime.RpcFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  // Search for existing matches with open slots (0 or 1 player)
  const maxMatches = 10;
  const minPlayers = 0;
  const maxPlayers = 1; // Look for matches with 0-1 players (open for joining)
  const label = JSON.stringify({ mode: 'classic', open: true });
  
  logger.info(`Searching for matches with label: ${label}`);
  const matches = nk.matchList(maxMatches, true, label, minPlayers, maxPlayers, null);
  logger.info(`Found ${matches ? matches.length : 0} matches`);
  
  if (matches && matches.length > 0) {
    // Found an open match - return the first one
    logger.info(`Joining existing match: ${matches[0].matchId} with ${matches[0].size} players`);
    return JSON.stringify({ matchId: matches[0].matchId });
  }
  
  // No open matches - create a new one
  logger.info('No open matches found, creating new match');
  const matchId = nk.matchCreate(moduleName, {});
  logger.info(`Created new match: ${matchId}`);
  return JSON.stringify({ matchId });
};

const matchInit: nkruntime.MatchInitFunction<MatchState> = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, params: {[key: string]: string}): { state: MatchState; tickRate: number; label: string } {
  const state: MatchState = {
    gameState: {
      board: Array(9).fill(null),
      currentPlayer: 'X',
      players: {},
      winner: null,
      startTime: Date.now(),
      turnStartTime: Date.now(),
      timePerTurn: 30000 // 30 seconds per turn
    }
  };

  const label = JSON.stringify({ mode: 'classic', open: true });
  
  return {
    state,
    tickRate: 1, // 1 tick per second for timer
    label
  };
};

const matchJoinAttempt: nkruntime.MatchJoinAttemptFunction<MatchState> = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, presence: nkruntime.Presence, metadata: {[key: string]: any}): { state: MatchState; accept: boolean; rejectMessage?: string } | null {
  
  const playerCount = Object.keys(state.gameState.players).length;
  
  if (playerCount >= 2) {
    return {
      state,
      accept: false,
      rejectMessage: "Match is full"
    };
  }

  return {
    state,
    accept: true
  };
};

const matchJoin: nkruntime.MatchJoinFunction<MatchState> = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, presences: nkruntime.Presence[]): { state: MatchState } | null {
  
  for (const presence of presences) {
    const playerCount = Object.keys(state.gameState.players).length;
    
    if (playerCount < 2) {
      const mark = playerCount === 0 ? 'X' : 'O';
      state.gameState.players[presence.userId] = {
        mark,
        userId: presence.userId,
        username: presence.username
      };
      
      logger.info(`Player ${presence.username} joined as ${mark}`);
    }
  }

  // Broadcast current state to all players
  dispatcher.broadcastMessage(1, JSON.stringify({ type: 'gameState', data: state.gameState }), null, null);
  
  // If we have 2 players, start the game
  if (Object.keys(state.gameState.players).length === 2) {
    state.gameState.startTime = Date.now();
    state.gameState.turnStartTime = Date.now();
    dispatcher.broadcastMessage(2, JSON.stringify({ type: 'gameStart', data: state.gameState }), null, null);
  }

  return { state };
};

const matchLeave: nkruntime.MatchLeaveFunction<MatchState> = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, presences: nkruntime.Presence[]): { state: MatchState } | null {
  
  for (const presence of presences) {
    // Player left - opponent wins by forfeit
    const leavingPlayer = state.gameState.players[presence.userId];
    
    if (leavingPlayer && !state.gameState.winner) {
      const remainingPlayer = Object.values(state.gameState.players).find(p => p.userId !== presence.userId);
      
      if (remainingPlayer) {
        state.gameState.winner = remainingPlayer.mark;
        
        // Update leaderboard
        updateLeaderboard(nk, remainingPlayer.userId, true);
        updateLeaderboard(nk, presence.userId, false);
        
        dispatcher.broadcastMessage(4, JSON.stringify({ 
          type: 'gameEnd', 
          data: { 
            winner: state.gameState.winner, 
            reason: 'forfeit',
            gameState: state.gameState 
          } 
        }), null, null);
      }
    }
    
    delete state.gameState.players[presence.userId];
  }

  return { state };
};

const matchLoop: nkruntime.MatchLoopFunction<MatchState> = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, messages: nkruntime.MatchMessage[]): { state: MatchState } | null {
  
  // Check for turn timeout
  const now = Date.now();
  if (!state.gameState.winner && Object.keys(state.gameState.players).length === 2) {
    const elapsed = now - state.gameState.turnStartTime;
    
    if (elapsed > state.gameState.timePerTurn) {
      // Current player loses due to timeout
      const currentPlayerId = Object.keys(state.gameState.players).find(
        uid => state.gameState.players[uid].mark === state.gameState.currentPlayer
      );
      
      if (currentPlayerId) {
        const winner = state.gameState.currentPlayer === 'X' ? 'O' : 'X';
        state.gameState.winner = winner;
        
        const winningPlayer = Object.values(state.gameState.players).find(p => p.mark === winner);
        const losingPlayer = Object.values(state.gameState.players).find(p => p.mark !== winner);
        
        if (winningPlayer && losingPlayer) {
          updateLeaderboard(nk, winningPlayer.userId, true);
          updateLeaderboard(nk, losingPlayer.userId, false);
        }
        
        dispatcher.broadcastMessage(4, JSON.stringify({ 
          type: 'gameEnd', 
          data: { 
            winner, 
            reason: 'timeout',
            gameState: state.gameState 
          } 
        }), null, null);
      }
    }
  }

  // Process player moves
  for (const message of messages) {
    switch (message.opCode) {
      case 3: // Move message
        const moveData = JSON.parse(nk.binaryToString(message.data));
        const player = state.gameState.players[message.sender.userId];
        
        if (!player || state.gameState.winner) {
          continue;
        }
        
        // Validate it's the player's turn
        if (player.mark !== state.gameState.currentPlayer) {
          dispatcher.broadcastMessage(5, JSON.stringify({ 
            type: 'error', 
            message: 'Not your turn' 
          }), [message.sender], null);
          continue;
        }
        
        // Validate move
        const position = moveData.position;
        if (position < 0 || position > 8 || state.gameState.board[position] !== null) {
          dispatcher.broadcastMessage(5, JSON.stringify({ 
            type: 'error', 
            message: 'Invalid move' 
          }), [message.sender], null);
          continue;
        }
        
        // Apply move
        state.gameState.board[position] = player.mark;
        state.gameState.turnStartTime = Date.now();
        
        // Check for winner
        const winner = checkWinner(state.gameState.board);
        
        if (winner) {
          state.gameState.winner = winner;
          
          if (winner !== 'draw') {
            const winningPlayer = Object.values(state.gameState.players).find(p => p.mark === winner);
            const losingPlayer = Object.values(state.gameState.players).find(p => p.mark !== winner);
            
            if (winningPlayer && losingPlayer) {
              updateLeaderboard(nk, winningPlayer.userId, true);
              updateLeaderboard(nk, losingPlayer.userId, false);
            }
          }
          
          dispatcher.broadcastMessage(4, JSON.stringify({ 
            type: 'gameEnd', 
            data: { 
              winner, 
              reason: 'complete',
              gameState: state.gameState 
            } 
          }), null, null);
        } else {
          // Switch turn
          state.gameState.currentPlayer = state.gameState.currentPlayer === 'X' ? 'O' : 'X';
          
          // Broadcast updated state
          dispatcher.broadcastMessage(1, JSON.stringify({ 
            type: 'gameState', 
            data: state.gameState 
          }), null, null);
        }
        break;
    }
  }

  return { state };
};

const matchTerminate: nkruntime.MatchTerminateFunction<MatchState> = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, graceSeconds: number): { state: MatchState } | null {
  return { state };
};

const matchSignal: nkruntime.MatchSignalFunction<MatchState> = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, dispatcher: nkruntime.MatchDispatcher, tick: number, state: MatchState, data: string): { state: MatchState; data?: string } | null {
  return { state };
};

function checkWinner(board: (string | null)[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];
  
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  
  // Check for draw
  if (board.every(cell => cell !== null)) {
    return 'draw';
  }
  
  return null;
}

function updateLeaderboard(nk: nkruntime.Nakama, userId: string, won: boolean): void {
  const leaderboardId = 'tictactoe_wins';
  const increment = won ? 1 : 0;
  
  try {
    nk.leaderboardRecordWrite(leaderboardId, userId, userId, increment, 0, null, null);
  } catch (error) {
    // Leaderboard might not exist yet
  }
}

const rpcGetLeaderboard: nkruntime.RpcFunction = function(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, payload: string): string {
  const leaderboardId = 'tictactoe_wins';
  
  try {
    const records = nk.leaderboardRecordsList(leaderboardId, null, 10, null, 0);
    return JSON.stringify({ records: records.records });
  } catch (error) {
    return JSON.stringify({ records: [] });
  }
};

// Register functions
function InitModule(ctx: nkruntime.Context, logger: nkruntime.Logger, nk: nkruntime.Nakama, initializer: nkruntime.Initializer) {
  // Register RPCs
  initializer.registerRpc("create_match", rpcCreateMatch);
  initializer.registerRpc("find_match", rpcFindMatch);
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  
  // Register match handler
  initializer.registerMatch(moduleName, {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal
  });
  
  // Create leaderboard
  try {
    nk.leaderboardCreate('tictactoe_wins', false, 'desc', 'best', 'set', false);
  } catch (error) {
    // Leaderboard already exists
  }
  
  logger.info('Tic-Tac-Toe module loaded');
}

// DO NOT CHANGE: Required export
!InitModule && InitModule.bind(null);