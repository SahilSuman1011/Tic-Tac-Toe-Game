// tictactoe.ts
var moduleName = "tictactoe";
var rpcCreateMatch = function(ctx, logger, nk, payload) {
  const matchId = nk.matchCreate(moduleName, {});
  return JSON.stringify({ matchId });
};
var rpcFindMatch = function(ctx, logger, nk, payload) {
  const maxMatches = 10;
  const minPlayers = 0;
  const maxPlayers = 1;
  const label = JSON.stringify({ mode: "classic", open: true });
  logger.info(`Searching for matches with label: ${label}`);
  const matches = nk.matchList(maxMatches, true, label, minPlayers, maxPlayers, null);
  logger.info(`Found ${matches ? matches.length : 0} matches`);
  if (matches && matches.length > 0) {
    logger.info(`Joining existing match: ${matches[0].matchId} with ${matches[0].size} players`);
    return JSON.stringify({ matchId: matches[0].matchId });
  }
  logger.info("No open matches found, creating new match");
  const matchId = nk.matchCreate(moduleName, {});
  logger.info(`Created new match: ${matchId}`);
  return JSON.stringify({ matchId });
};
var matchInit = function(ctx, logger, nk, params) {
  const state = {
    gameState: {
      board: Array(9).fill(null),
      currentPlayer: "X",
      players: {},
      winner: null,
      startTime: Date.now(),
      turnStartTime: Date.now(),
      timePerTurn: 3e4
      // 30 seconds per turn
    }
  };
  const label = JSON.stringify({ mode: "classic", open: true });
  return {
    state,
    tickRate: 1,
    // 1 tick per second for timer
    label
  };
};
var matchJoinAttempt = function(ctx, logger, nk, dispatcher, tick, state, presence, metadata) {
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
var matchJoin = function(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (const presence of presences) {
    const playerCount = Object.keys(state.gameState.players).length;
    if (playerCount < 2) {
      const mark = playerCount === 0 ? "X" : "O";
      state.gameState.players[presence.userId] = {
        mark,
        userId: presence.userId,
        username: presence.username
      };
      logger.info(`Player ${presence.username} joined as ${mark}`);
    }
  }
  dispatcher.broadcastMessage(1, JSON.stringify({ type: "gameState", data: state.gameState }), null, null);
  if (Object.keys(state.gameState.players).length === 2) {
    state.gameState.startTime = Date.now();
    state.gameState.turnStartTime = Date.now();
    dispatcher.broadcastMessage(2, JSON.stringify({ type: "gameStart", data: state.gameState }), null, null);
  }
  return { state };
};
var matchLeave = function(ctx, logger, nk, dispatcher, tick, state, presences) {
  for (const presence of presences) {
    const leavingPlayer = state.gameState.players[presence.userId];
    if (leavingPlayer && !state.gameState.winner) {
      const remainingPlayer = Object.values(state.gameState.players).find((p) => p.userId !== presence.userId);
      if (remainingPlayer) {
        state.gameState.winner = remainingPlayer.mark;
        updateLeaderboard(nk, remainingPlayer.userId, true);
        updateLeaderboard(nk, presence.userId, false);
        dispatcher.broadcastMessage(4, JSON.stringify({
          type: "gameEnd",
          data: {
            winner: state.gameState.winner,
            reason: "forfeit",
            gameState: state.gameState
          }
        }), null, null);
      }
    }
    delete state.gameState.players[presence.userId];
  }
  return { state };
};
var matchLoop = function(ctx, logger, nk, dispatcher, tick, state, messages) {
  const now = Date.now();
  if (!state.gameState.winner && Object.keys(state.gameState.players).length === 2) {
    const elapsed = now - state.gameState.turnStartTime;
    if (elapsed > state.gameState.timePerTurn) {
      const currentPlayerId = Object.keys(state.gameState.players).find(
        (uid) => state.gameState.players[uid].mark === state.gameState.currentPlayer
      );
      if (currentPlayerId) {
        const winner = state.gameState.currentPlayer === "X" ? "O" : "X";
        state.gameState.winner = winner;
        const winningPlayer = Object.values(state.gameState.players).find((p) => p.mark === winner);
        const losingPlayer = Object.values(state.gameState.players).find((p) => p.mark !== winner);
        if (winningPlayer && losingPlayer) {
          updateLeaderboard(nk, winningPlayer.userId, true);
          updateLeaderboard(nk, losingPlayer.userId, false);
        }
        dispatcher.broadcastMessage(4, JSON.stringify({
          type: "gameEnd",
          data: {
            winner,
            reason: "timeout",
            gameState: state.gameState
          }
        }), null, null);
      }
    }
  }
  for (const message of messages) {
    switch (message.opCode) {
      case 3:
        const moveData = JSON.parse(nk.binaryToString(message.data));
        const player = state.gameState.players[message.sender.userId];
        if (!player || state.gameState.winner) {
          continue;
        }
        if (player.mark !== state.gameState.currentPlayer) {
          dispatcher.broadcastMessage(5, JSON.stringify({
            type: "error",
            message: "Not your turn"
          }), [message.sender], null);
          continue;
        }
        const position = moveData.position;
        if (position < 0 || position > 8 || state.gameState.board[position] !== null) {
          dispatcher.broadcastMessage(5, JSON.stringify({
            type: "error",
            message: "Invalid move"
          }), [message.sender], null);
          continue;
        }
        state.gameState.board[position] = player.mark;
        state.gameState.turnStartTime = Date.now();
        const winner = checkWinner(state.gameState.board);
        if (winner) {
          state.gameState.winner = winner;
          if (winner !== "draw") {
            const winningPlayer = Object.values(state.gameState.players).find((p) => p.mark === winner);
            const losingPlayer = Object.values(state.gameState.players).find((p) => p.mark !== winner);
            if (winningPlayer && losingPlayer) {
              updateLeaderboard(nk, winningPlayer.userId, true);
              updateLeaderboard(nk, losingPlayer.userId, false);
            }
          }
          dispatcher.broadcastMessage(4, JSON.stringify({
            type: "gameEnd",
            data: {
              winner,
              reason: "complete",
              gameState: state.gameState
            }
          }), null, null);
        } else {
          state.gameState.currentPlayer = state.gameState.currentPlayer === "X" ? "O" : "X";
          dispatcher.broadcastMessage(1, JSON.stringify({
            type: "gameState",
            data: state.gameState
          }), null, null);
        }
        break;
    }
  }
  return { state };
};
var matchTerminate = function(ctx, logger, nk, dispatcher, tick, state, graceSeconds) {
  return { state };
};
var matchSignal = function(ctx, logger, nk, dispatcher, tick, state, data) {
  return { state };
};
function checkWinner(board) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    // rows
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    // columns
    [0, 4, 8],
    [2, 4, 6]
    // diagonals
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((cell) => cell !== null)) {
    return "draw";
  }
  return null;
}
function updateLeaderboard(nk, userId, won) {
  const leaderboardId = "tictactoe_wins";
  const increment = won ? 1 : 0;
  try {
    nk.leaderboardRecordWrite(leaderboardId, userId, userId, increment, 0, null, null);
  } catch (error) {
  }
}
var rpcGetLeaderboard = function(ctx, logger, nk, payload) {
  const leaderboardId = "tictactoe_wins";
  try {
    const records = nk.leaderboardRecordsList(leaderboardId, null, 10, null, 0);
    return JSON.stringify({ records: records.records });
  } catch (error) {
    return JSON.stringify({ records: [] });
  }
};
function InitModule(ctx, logger, nk, initializer) {
  initializer.registerRpc("create_match", rpcCreateMatch);
  initializer.registerRpc("find_match", rpcFindMatch);
  initializer.registerRpc("get_leaderboard", rpcGetLeaderboard);
  initializer.registerMatch(moduleName, {
    matchInit,
    matchJoinAttempt,
    matchJoin,
    matchLeave,
    matchLoop,
    matchTerminate,
    matchSignal
  });
  try {
    nk.leaderboardCreate("tictactoe_wins", false, "desc", "best", "set", false);
  } catch (error) {
  }
  logger.info("Tic-Tac-Toe module loaded");
}
!InitModule && InitModule.bind(null);
