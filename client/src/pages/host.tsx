import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crown, Play, Users, Brain } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";

const createQuizSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  questionCount: z.coerce.number().min(5, "Minimum 5 questions").max(20, "Maximum 20 questions"),
  timePerQuestion: z.coerce.number().min(10, "Minimum 10 seconds").max(60, "Maximum 60 seconds"),
});

type CreateQuizForm = z.infer<typeof createQuizSchema>;

export default function Host() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [hostId] = useState(() => {
    // Try to get existing hostId from localStorage or generate new one
    const existingHostId = localStorage.getItem('quizHostId');
    if (existingHostId) {
      return existingHostId;
    }
    const newHostId = `host_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('quizHostId', newHostId);
    return newHostId;
  });
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [players, setPlayers] = useState<any[]>([]);

  const { isConnected, sendMessage, connect } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'player-joined':
          setPlayers(message.players);
          toast({
            title: "Player Joined",
            description: `A new player has joined the quiz room.`,
          });
          break;
        case 'quiz-started':
          // Small delay to ensure the message is processed
          setTimeout(() => {
            navigate(`/quiz?room=${roomCode}&host=${hostId}`);
          }, 100);
          break;
      }
    },
    onConnect: () => {
      if (roomCode) {
        sendMessage({
          type: 'join-room',
          roomCode,
          playerId: hostId,
          isHost: true,
        });
      }
    },
  });

  const form = useForm<CreateQuizForm>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: {
      topic: "",
      questionCount: 10,
      timePerQuestion: 10,
    },
  });

  const createQuizMutation = useMutation({
    mutationFn: async (data: CreateQuizForm) => {
      const response = await apiRequest("POST", "/api/quiz/create", {
        ...data,
        hostId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setRoomCode(data.roomCode);
      connect();
      toast({
        title: "Quiz Created!",
        description: `Room code: ${data.roomCode}`,
      });
    },
    onError: (error) => {
      console.error('Quiz creation error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to create quiz',
        variant: "destructive",
      });
    },
  });

  const { data: roomData } = useQuery<{ players: any[] }>({
    queryKey: ['/api/quiz', roomCode],
    enabled: !!roomCode,
    refetchInterval: 3000,
  });

useEffect(() => {
    if (roomData && Array.isArray(roomData.players)) {
      setPlayers(roomData.players);
    } else {
      console.warn("roomData does not contain a valid players array:", roomData);
    }
  }, [roomData]);

  const onSubmit = (data: CreateQuizForm) => {
    createQuizMutation.mutate(data);
  };

  const startQuiz = useCallback(() => {

    if (players.filter(p => !p.isHost).length < 1) {
      toast({
        title: "No Players",
        description: "Wait for at least one player to join before starting.",
        variant: "destructive",
      });
      return;
    }

    sendMessage({
      type: 'start-quiz',
      roomCode,
      playerId: hostId,
      isHost: true,
    });

    // TEMP fallback: force navigate after 2 seconds if no WS response
    setTimeout(() => {
      navigate(`/quiz?room=${roomCode}&host=${hostId}`);
    }, 2000);
  }, [players, roomCode, sendMessage, navigate, toast]);

  const getPlayerInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen p-4">
      <LoadingOverlay 
        isVisible={createQuizMutation.isPending}
        title="Generating Quiz..."
        message="AI is creating questions based on your topic. This may take a moment."
      />
      
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center text-gray-600 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3">
              <Crown className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-semibold text-gray-800">Host Dashboard</span>
          </div>
        </div>

        {!roomCode ? (
          /* Quiz Creation Form */
          <Card className="bg-white rounded-3xl shadow-2xl">
            <CardContent className="p-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Create Your Quiz</h2>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="topic"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">Quiz Topic or Prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter your quiz topic or provide a detailed prompt for AI to generate questions. Example: 'World History of the 20th Century' or 'Basic Python Programming Concepts'"
                            className="resize-none h-32"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="questionCount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Number of Questions</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select number of questions" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="5">5 Questions</SelectItem>
                              <SelectItem value="10">10 Questions</SelectItem>
                              <SelectItem value="15">15 Questions</SelectItem>
                              <SelectItem value="20">20 Questions</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="timePerQuestion"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-gray-700">Time per Question</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select time limit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="10">10 seconds</SelectItem>
                              <SelectItem value="15">15 seconds</SelectItem>
                              <SelectItem value="30">30 seconds</SelectItem>
                              <SelectItem value="45">45 seconds</SelectItem>
                              <SelectItem value="60">60 seconds</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold py-4 px-8 rounded-xl hover:from-indigo-600 hover:to-violet-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                    disabled={createQuizMutation.isPending}
                  >
                    <Brain className="w-5 h-5 mr-2" />
                    Generate Quiz with AI
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          /* Quiz Room */
          <Card className="bg-white rounded-3xl shadow-2xl">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Quiz Room Created!</h3>
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-6 mb-6">
                <p className="text-gray-600 mb-2">Share this room code with participants:</p>
                <div className="font-mono text-4xl font-bold text-indigo-600 tracking-wider">
                  {roomCode}
                </div>
              </div>
              
              {/* Connected Players */}
              <div className="bg-gray-50 rounded-2xl p-6 mb-6">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Connected Players ({players.filter(p => !p.isHost).length})
                </h4>
                {players.filter(p => !p.isHost).length === 0 ? (
                  <p className="text-gray-500 py-8">
                    <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    Waiting for players to join...
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {players.filter(p => !p.isHost).map((player) => (
                      <div key={player.id} className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-2">
                          <span className="text-white font-semibold text-sm">
                            {getPlayerInitials(player.name)}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800">{player.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Connection Status */}
              <div className={`rounded-xl p-4 mb-6 ${
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

              {/* Start Quiz Button */}
              <Button
                onClick={startQuiz}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold py-4 px-8 rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
                disabled={!isConnected || players.filter(p => !p.isHost).length === 0}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Quiz
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
