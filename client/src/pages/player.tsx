import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Users, LogIn, Clock } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";

const joinQuizSchema = z.object({
  name: z.string().min(1, "Name is required"),
  roomCode: z.string().length(6, "Room code must be 6 characters"),
});

type JoinQuizForm = z.infer<typeof joinQuizSchema>;

export default function Player() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [playerId] = useState(() => {
    // Try to get existing playerId from localStorage or generate new one
    const existingPlayerId = localStorage.getItem('quizPlayerId');
    if (existingPlayerId) {
      return existingPlayerId;
    }
    const newPlayerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('quizPlayerId', newPlayerId);
    return newPlayerId;
  });
  const [joinedRoom, setJoinedRoom] = useState<any>(null);
  const [waitingForStart, setWaitingForStart] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState<any[]>([]);
  const joinedRoomRef = useRef<any>(null);

  const { isConnected, sendMessage, connect } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'player-joined':
          setOtherPlayers(message.players.filter((p: any) => p.playerId !== playerId));
          break;
        case 'quiz-started':
          // Small delay to ensure WebSocket connection is stable
          setTimeout(() => {
            navigate(`/quiz?room=${joinedRoom.roomCode}&player=${playerId}`);
          }, 500);
          break;
      }
    },
    onConnect: () => {
      if (joinedRoomRef.current) {
        sendMessage({
          type: 'join-room',
          roomCode: joinedRoomRef.current.roomCode,
          playerId,
          isHost: false,
        });
      }
    },
  });

  const form = useForm<JoinQuizForm>({
    resolver: zodResolver(joinQuizSchema),
    defaultValues: {
      name: "",
      roomCode: "",
    },
  });

  const joinQuizMutation = useMutation({
    mutationFn: async (data: JoinQuizForm) => {
      const response = await apiRequest("POST", "/api/quiz/join", {
        ...data,
        playerId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setJoinedRoom(data.room);
      joinedRoomRef.current = data.room; // Store in ref for immediate access
      setWaitingForStart(true);
      setOtherPlayers(data.players.filter((p: any) => p.playerId !== playerId));
      
      // Connect to WebSocket immediately
      connect();
      
      toast({
        title: "Joined Successfully!",
        description: `Welcome to the quiz room.`,
      });
    },
    onError: (error) => {
      console.error('Join quiz error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to join quiz',
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JoinQuizForm) => {
    joinQuizMutation.mutate(data);
  };

  const getPlayerInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const roomCodeField = form.watch("roomCode");

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl flex items-center justify-center mr-3">
              <Users className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-semibold text-gray-800">Join Quiz</span>
          </div>
        </div>

        {/* Join Form */}
        <Card className="bg-white rounded-3xl shadow-2xl">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Join a Quiz Room</h2>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        Your Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roomCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-medium text-gray-700 mb-2 text-left">
                        Room Code
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC123"
                          className="font-mono text-2xl text-center tracking-wider uppercase"
                          maxLength={6}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white font-semibold py-4 px-8 rounded-xl hover:from-violet-600 hover:to-violet-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                  disabled={joinQuizMutation.isPending}
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Join Quiz
                </Button>
              </form>
            </Form>

            {/* Waiting Room */}
            {waitingForStart && (
              <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-6 mb-6">
                  <Clock className="text-violet-500 w-12 h-12 mb-4 mx-auto animate-pulse" />
                  <h3 className="text-xl font-bold text-gray-800 mb-2">Waiting for Host</h3>
                  <p className="text-gray-600">
                    You've successfully joined the quiz room. Waiting for the host to start the quiz...
                  </p>
                </div>
                
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h4 className="font-semibold text-gray-800 mb-4">
                    Other Players in Room ({otherPlayers.length})
                  </h4>
                  {otherPlayers.length === 0 ? (
                    <p className="text-gray-500 py-4">No other players yet...</p>
                  ) : (
                    <div className="flex justify-center space-x-4 flex-wrap gap-2">
                      {otherPlayers.map((player) => (
                        <div key={player.id} className="text-center">
                          <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
                            <span className="text-white font-semibold text-sm">
                              {getPlayerInitials(player.name)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{player.name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Connection Status */}
                <div className={`rounded-xl p-4 mt-6 ${
                  isConnected 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <div className="flex items-center justify-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${
                      isConnected ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></div>
                    <p className={isConnected ? 'text-green-800' : 'text-yellow-800'}>
                      {isConnected ? 'Connected to real-time server' : 'Connecting to real-time server...'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
