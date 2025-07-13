import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trophy, Home, Share2, Crown, Medal, Award, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface LeaderboardPlayer {
  id: number;
  name: string;
  playerId: string;
  score: number;
  isHost: boolean;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
}

export default function Leaderboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [roomCode, setRoomCode] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [isHost, setIsHost] = useState(false);

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const player = params.get('player');
    const host = params.get('host');
    
    if (room) setRoomCode(room);
    
    if (host) {
      setIsHost(true);
      // For hosts, use the hostId from localStorage if available
      const storedHostId = localStorage.getItem('quizHostId');
      if (storedHostId) {
        setPlayerId(storedHostId);
      } else if (host && host !== 'false') {
        setPlayerId(host);
      }
    } else if (player && player !== 'false') {
      setPlayerId(player);
    }
  }, []);

  const { data: leaderboardData, isLoading, error } = useQuery({
    queryKey: ['/api/quiz', roomCode, 'leaderboard'],
    queryFn: async () => {
      const response = await fetch(`/api/quiz/${roomCode}/leaderboard`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📊 Leaderboard error response:', errorText);
        throw new Error(`Failed to fetch leaderboard: ${response.status} ${errorText}`);
      }
      const data = await response.json();
      
      // If this is a host and we have room data, use the actual host ID from the room
      if (isHost && data.room?.hostId && data.room.hostId !== playerId) {
        setPlayerId(data.room.hostId);
      }
      
      // If playerId is still not set, try to find the current user in the leaderboard
      if (!playerId && data.leaderboard) {
        // For hosts, look for the host entry
        if (isHost) {
          const hostEntry = data.leaderboard.find(p => p.isHost);
          if (hostEntry) {
            setPlayerId(hostEntry.playerId);
          }
        } else {
          // For players, look for non-host entries (assuming they're the only non-host)
          const playerEntry = data.leaderboard.find(p => !p.isHost);
          if (playerEntry) {
            setPlayerId(playerEntry.playerId);
          }
        }
      }
      
      return data;
    },
    enabled: !!roomCode,
  });

  const getPlayerInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPlayerColor = (index: number) => {
    const colors = [
      'from-emerald-400 to-emerald-500',
      'from-blue-400 to-blue-500',
      'from-purple-400 to-purple-500',
      'from-amber-400 to-amber-500',
      'from-red-400 to-red-500',
      'from-indigo-400 to-indigo-500',
      'from-pink-400 to-pink-500',
      'from-teal-400 to-teal-500',
    ];
    return colors[index % colors.length];
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-amber-400 to-amber-500';
      case 2: return 'from-gray-400 to-gray-500';
      case 3: return 'from-amber-600 to-amber-700';
      default: return 'from-gray-300 to-gray-400';
    }
  };

  const getScoreColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-emerald-600';
      case 2: return 'text-blue-600';
      case 3: return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getBgColor = (rank: number) => {
    switch (rank) {
      case 1: return 'from-emerald-50 to-emerald-100 border-emerald-200';
      case 2: return 'from-blue-50 to-blue-100 border-blue-200';
      case 3: return 'from-purple-50 to-purple-100 border-purple-200';
      default: return 'from-gray-50 to-gray-100 border-gray-200';
    }
  };

  const checkForTies = (players: LeaderboardPlayer[]) => {
    const topThree = players.slice(0, 3);
    const ties = [];
    
    // Check for ties between positions
    if (topThree.length >= 2 && topThree[0].score === topThree[1].score) {
      ties.push(0, 1);
    }
    if (topThree.length >= 3 && topThree[1].score === topThree[2].score) {
      if (!ties.includes(1)) ties.push(1);
      ties.push(2);
    }
    if (topThree.length >= 3 && topThree[0].score === topThree[2].score) {
      if (!ties.includes(0)) ties.push(0);
      if (!ties.includes(2)) ties.push(2);
    }
    
    return ties;
  };

  const shareResults = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Quiz Results - QuizGen',
        text: `Check out the results from our quiz! Room: ${roomCode}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied!",
        description: "Results link copied to clipboard",
      });
    }
  };

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      if (!playerId) {
        throw new Error('Player ID is required for cleanup');
      }
      
      // Double-check if this user is actually the host by comparing with room data
      let shouldBeHost = isHost;
      if (leaderboardData?.room?.hostId) {
        shouldBeHost = playerId === leaderboardData.room.hostId;
      }
      
      if (shouldBeHost) {
        // For hosts, first check if we need to use the room's actual host ID
        let actualPlayerId = playerId;
        
        // If we have leaderboard data and the current playerId doesn't match the room's hostId,
        // but the current user is marked as host, use the room's hostId
        if (leaderboardData?.room?.hostId && leaderboardData.room.hostId !== playerId) {
          actualPlayerId = leaderboardData.room.hostId;
        }
        
        // Host cleans up the entire room
        const response = await fetch(`/api/quiz/${roomCode}/cleanup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playerId: actualPlayerId,
            isHost: true,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Cleanup failed:', { status: response.status, error: errorData });
          // Don't throw error - just return silently
          return;
        }
        
        const result = await response.json();
      } else {
        // Player leaves the room
        
        const response = await fetch('/api/quiz/player/leave', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            playerId,
            roomCode,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Leave failed:', { status: response.status, error: errorData });
          // Don't throw error - just return silently
          return;
        }
        
        const result = await response.json();
      }
    },
    onSuccess: () => {
    },
    onError: (error) => {
      console.error('❌ Cleanup mutation failed:', error);
      // Completely silent - no error handling
    },
  });

  const handleNewQuiz = async () => {
    
    if (!playerId) {
      console.error('❌ No playerId available for cleanup');
      // Navigate to home anyway
      window.location.href = '/';
      return;
    }

    // Just call the mutation without try-catch - let it fail silently
    cleanupMutation.mutate();
    // Navigate to home immediately
    window.location.href = '/';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-amber-500 animate-pulse" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Loading Results...</h2>
            <p className="text-gray-600">Calculating final scores...</p>
            <div className="mt-4">
              <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    console.error('📊 Leaderboard error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Results</h2>
            <p className="text-gray-600 mb-4">{error.message}</p>
            <p className="text-sm text-gray-500 mb-6">Room: {roomCode}</p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-indigo-600 hover:to-violet-700 transition-all duration-300">
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!leaderboardData?.leaderboard) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">No Results Found</h2>
            <p className="text-gray-600 mb-6">Unable to load quiz results. The quiz may not be finished yet.</p>
            <Link href="/">
              <Button className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-indigo-600 hover:to-violet-700 transition-all duration-300">
                <Home className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const players = leaderboardData.leaderboard;
  const topThree = players.slice(0, 3);
  const ties = checkForTies(players);

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-500 rounded-3xl mb-6 shadow-2xl">
            <Trophy className="text-white w-8 h-8" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Quiz Complete!</h2>
          <p className="text-lg md:text-xl text-gray-600">Here are the final results</p>
        </div>

        {/* Podium */}
        <Card className="bg-white rounded-3xl shadow-2xl mb-8">
          <CardContent className="p-4 md:p-8">
            <div className="flex flex-row justify-center items-end gap-2 sm:gap-4 md:gap-6 lg:gap-8 mb-8 min-h-[120px] sm:min-h-[140px] md:min-h-[160px]">
              {/* 2nd Place */}
              {topThree[1] && (
                <div className="text-center flex flex-col items-center justify-end flex-1 max-w-[120px] sm:max-w-[140px] md:max-w-[160px]">
                  <div className="relative mb-2 sm:mb-3 md:mb-4">
                    <div className={`w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br ${getPlayerColor(1)} rounded-full flex items-center justify-center`}>
                      <span className="text-white font-bold text-sm md:text-lg">
                        {getPlayerInitials(topThree[1].name)}
                      </span>
                    </div>
                    {/* Crown or tie overlay */}
                    {ties.includes(1) ? (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                          <Minus className="text-white w-3 h-3 md:w-4 md:h-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center">
                          <Crown className="text-white w-3 h-3 md:w-4 md:h-4" />
                        </div>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 mb-1 text-xs sm:text-sm md:text-base truncate w-full">{topThree[1].name}</h3>
                </div>
              )}

              {/* 1st Place */}
              {topThree[0] && (
                <div className="text-center flex flex-col items-center justify-end flex-1 max-w-[140px] sm:max-w-[160px] md:max-w-[180px]">
                  <div className="relative mb-2 sm:mb-3 md:mb-4">
                    <div className={`w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br ${getPlayerColor(0)} rounded-full flex items-center justify-center`}>
                      <span className="text-white font-bold text-base md:text-xl">
                        {getPlayerInitials(topThree[0].name)}
                      </span>
                    </div>
                    {/* Crown or tie overlay */}
                    {ties.includes(0) ? (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                          <Minus className="text-white w-3 h-3 md:w-4 md:h-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center">
                          <Crown className="text-white w-3 h-3 md:w-4 md:h-4" />
                        </div>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm sm:text-base md:text-xl mb-1 truncate w-full">{topThree[0].name}</h3>
                </div>
              )}

              {/* 3rd Place */}
              {topThree[2] && (
                <div className="text-center flex flex-col items-center justify-end flex-1 max-w-[120px] sm:max-w-[140px] md:max-w-[160px]">
                  <div className="relative mb-2 sm:mb-3 md:mb-4">
                    <div className={`w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br ${getPlayerColor(2)} rounded-full flex items-center justify-center`}>
                      <span className="text-white font-bold text-sm md:text-lg">
                        {getPlayerInitials(topThree[2].name)}
                      </span>
                    </div>
                    {/* Crown or tie overlay */}
                    {ties.includes(2) ? (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center">
                          <Minus className="text-white w-3 h-3 md:w-4 md:h-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-6 h-6 md:w-7 md:h-7 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center">
                          <Crown className="text-white w-3 h-3 md:w-4 md:h-4" />
                        </div>
                      </div>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 mb-1 text-xs sm:text-sm md:text-base truncate w-full">{topThree[2].name}</h3>
                </div>
              )}
            </div>

            {/* Detailed Rankings */}
            <div className="space-y-4">
              <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-4">Detailed Rankings</h3>
              
              {players.map((player: LeaderboardPlayer, index: number) => (
                <div 
                  key={player.id} 
                  className={`bg-gradient-to-r ${getBgColor(index + 1)} rounded-2xl p-4 md:p-6 border-2`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="relative mr-4 md:mr-6">
                        <div className={`w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br ${getPlayerColor(index)} rounded-full flex items-center justify-center`}>
                          <span className="text-white font-bold text-sm md:text-lg">
                            {getPlayerInitials(player.name)}
                          </span>
                        </div>
                        {/* Crown overlay for top 3 */}
                        {index < 3 && (
                          <div className="absolute -top-1 -right-1">
                            <div className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center ${
                              index === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500' :
                              index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                              'bg-gradient-to-br from-amber-600 to-amber-700'
                            }`}>
                              <Crown className="text-white w-3 h-3 md:w-4 md:h-4" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center mb-1 gap-2">
                          <h4 className="font-bold text-gray-800 text-base md:text-lg truncate">{player.name}</h4>
                          {player.isHost && (
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full flex-shrink-0">
                              Host
                            </span>
                          )}
                        </div>
                        <div className="text-xs md:text-sm">
                          <p className="text-gray-600">
                            <span className="font-semibold">{player.correctAnswers}</span>/{player.totalQuestions} correct
                          </p>
                          <p className="text-gray-500 text-xs">
                            {Math.round(player.accuracy)}% accuracy
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className={`text-2xl md:text-3xl font-bold ${getScoreColor(index + 1)}`}>
                        {player.score}
                      </p>
                      <p className="text-xs md:text-sm text-gray-600">points</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleNewQuiz}
            disabled={cleanupMutation.isPending}
            className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold py-3 md:py-4 px-6 md:px-8 rounded-xl hover:from-indigo-600 hover:to-violet-700 transition-all duration-300 transform hover:scale-105 shadow-lg inline-flex items-center justify-center text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Home className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            {cleanupMutation.isPending ? 'Cleaning up...' : 'New Quiz'}
          </Button>
          <Button
            onClick={shareResults}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold py-3 md:py-4 px-6 md:px-8 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg inline-flex items-center justify-center text-sm md:text-base"
          >
            <Share2 className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Share Results
          </Button>
        </div>
      </div>
    </div>
  );
}
