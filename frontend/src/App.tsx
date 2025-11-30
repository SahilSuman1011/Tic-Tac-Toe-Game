import { useState, useEffect } from 'react';
import { Socket } from '@heroiclabs/nakama-js';
import Menu from './components/Menu';
import Matchmaking from './components/Matchmaking';
import Game from './components/Game';
import Leaderboard from './components/Leaderboard';
import { nakamaService } from './services/nakama';
import { GameState } from './types/game';

type AppState = 'menu' | 'matchmaking' | 'playing' | 'leaderboard';

function App() {
  const [appState, setAppState] = useState<AppState>('menu');
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [matchId, setMatchId] = useState<string>('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [stats, setStats] = useState({ wins: 0, losses: 0 });

  useEffect(() => {
    initNakama();
    return () => {
      nakamaService.disconnect();
    };
  }, []);

  const initNakama = async () => {
    try {
      const session = await nakamaService.authenticate();
      setUserId(session.user_id);
      
      const sock = await nakamaService.connectSocket();
      setSocket(sock);
      setConnected(true);

      // Setup message handlers
      sock.onmatchdata = (matchData) => {
        try {
          // Parse the message data
          let message;
          const data = matchData.data;
          
          if (typeof data === 'string') {
            message = JSON.parse(data);
          } else if (data instanceof Uint8Array) {
            const str = new TextDecoder().decode(data);
            message = JSON.parse(str);
          } else {
            console.error('Unknown data type:', typeof data);
            return;
          }
          
          console.log('Received message:', message.type, message);
          
          switch (message.type) {
            case 'gameState':
              setGameState(message.data);
              // If we have 2 players and we're in matchmaking, transition to playing
              const playerCount = Object.keys(message.data.players || {}).length;
              if (playerCount === 2 && appState === 'matchmaking') {
                setAppState('playing');
              }
              break;
              
            case 'gameStart':
              console.log('Game starting with state:', message.data);
              setGameState(message.data);
              setAppState('playing');
              break;
              
            case 'gameEnd':
              console.log('Game ended:', message.data);
              setGameState(message.data.gameState);
              
              // Update stats
              const winner = message.data.winner;
              const currentPlayer = message.data.gameState.players[session.user_id];
              
              if (currentPlayer && winner !== 'draw') {
                if (winner === currentPlayer.mark) {
                  setStats(prev => ({ ...prev, wins: prev.wins + 1 }));
                } else {
                  setStats(prev => ({ ...prev, losses: prev.losses + 1 }));
                }
              }
              
              // Return to menu after 3 seconds
              setTimeout(() => {
                setAppState('menu');
                setGameState(null);
                setMatchId('');
              }, 3000);
              break;
              
            case 'error':
              console.error('Server error:', message.message);
              // Show error to user (you can add a toast notification here)
              break;
              
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error processing match data:', error);
        }
      };

      sock.onmatchpresence = (presence) => {
        console.log('Match presence update:', presence);
        // Handle player joins/leaves if needed
      };

      sock.ondisconnect = () => {
        console.log('Socket disconnected');
        setConnected(false);
        // Optionally attempt reconnection
      };

    } catch (error) {
      console.error('Failed to initialize Nakama:', error);
      setConnected(false);
      // Show error to user
      alert('Failed to connect to game server. Please refresh and try again.');
    }
  };

  const handleFindMatch = async () => {
    if (!connected) {
      alert('Not connected to server. Please wait or refresh the page.');
      return;
    }

    setAppState('matchmaking');
    
    try {
      console.log('Finding match...');
      const matchIdResult = await nakamaService.findMatch();
      console.log('Match found:', matchIdResult);
      setMatchId(matchIdResult);
      
      console.log('Joining match...');
      const match = await nakamaService.joinMatch(matchIdResult);
      console.log('Match joined successfully:', match);
      
      // State transition handled by onmatchdata when players are ready
    } catch (error) {
      console.error('Failed to find/join match:', error);
      setAppState('menu');
      alert('Failed to find a match. Please try again.');
    }
  };

  const handleCancelMatchmaking = () => {
    // If we have a matchId, leave the match
    if (socket && matchId) {
      socket.leaveMatch(matchId);
      setMatchId('');
    }
    setAppState('menu');
  };

  const handleLeaveGame = () => {
    if (socket && matchId) {
      socket.leaveMatch(matchId);
    }
    setAppState('menu');
    setGameState(null);
    setMatchId('');
  };

  const handleViewLeaderboard = () => {
    setAppState('leaderboard');
  };

  const handleBackToMenu = () => {
    setAppState('menu');
  };

  // Render appropriate screen based on state
  if (appState === 'menu') {
    return (
      <Menu
        connected={connected}
        onFindMatch={handleFindMatch}
        onViewLeaderboard={handleViewLeaderboard}
        stats={stats}
      />
    );
  }

  if (appState === 'matchmaking') {
    return <Matchmaking onCancel={handleCancelMatchmaking} />;
  }

  if (appState === 'playing' && gameState) {
    return (
      <Game
        matchId={matchId}
        gameState={gameState}
        onLeave={handleLeaveGame}
        currentUserId={userId}
      />
    );
  }

  if (appState === 'leaderboard') {
    return <Leaderboard onBack={handleBackToMenu} />;
  }

  // Fallback - should never reach here
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Loading...</p>
      </div>
    </div>
  );
}

export default App;