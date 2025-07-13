import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Brain, Users, Clock, CheckCircle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";

interface Question {
  id: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  order: number;
}

export default function Quiz() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [roomCode, setRoomCode] = useState<string>("");
  const [playerId, setPlayerId] = useState<string>("");
  const [isHost, setIsHost] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [participants, setParticipants] = useState(0);
  
  // Ref to track previous question index
  const prevQuestionIndexRef = useRef<number>(-1);

  // Query to get room data and check if quiz has started
  const { data: roomData } = useQuery({
    queryKey: ['/api/quiz', roomCode],
    queryFn: async () => {
      if (!roomCode) return null;
      const response = await fetch(`/api/quiz/${roomCode}`);
      if (!response.ok) {
        throw new Error('Failed to fetch room data');
      }
      return response.json();
    },
    enabled: !!roomCode,
    refetchInterval: 2000, // Check every 2 seconds
  });

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const player = params.get('player');
    const host = params.get('host');
    
    if (room) setRoomCode(room);
    
    // For players, use the playerId from URL (which should match the one used when joining)
    // For hosts, use the hostId from localStorage to ensure consistency
    if (host) {
      setIsHost(true);
      const storedHostId = localStorage.getItem('quizHostId');
      if (storedHostId) {
        setPlayerId(storedHostId);
      } else {
        setPlayerId(host);
      }
    } else if (player) {
      setIsHost(false);
      setPlayerId(player);
    }
  }, []);

  // Check if quiz has already started and load first question
  useEffect(() => {
    if (roomData?.room?.status === 'active' && !currentQuestion) {
      // Fetch the first question
      const loadFirstQuestion = async () => {
        try {
          const response = await fetch(`/api/quiz/${roomCode}/questions`);
          if (response.ok) {
            const questions = await response.json();
            if (questions.length > 0) {
              const questionTime = roomData?.room?.timePerQuestion || 10;
              setCurrentQuestion(questions[0]);
              setQuestionIndex(0);
              setTotalQuestions(questions.length);
              setTimePerQuestion(questionTime);
              setSelectedAnswer(null);
              setHasAnswered(false);
              setHasSubmitted(false);
              setShowResult(false);
            }
          }
        } catch (error) {
          console.error("Failed to load first question:", error);
        }
      };
      loadFirstQuestion();
    }
  }, [roomData, currentQuestion, roomCode]);

  const { isConnected, sendMessage, connect } = useWebSocket({
    onMessage: (message) => {
      switch (message.type) {
        case 'quiz-started':
          setCurrentQuestion(message.question);
          setQuestionIndex(message.questionIndex);
          setTotalQuestions(message.totalQuestions);
          const questionTime = message.question?.timePerQuestion || 10;
          setTimePerQuestion(questionTime);
          setSelectedAnswer(null);
          setHasAnswered(false);
          setHasSubmitted(false);
          setShowResult(false);
          break;
        case 'next-question':
          // Always advance to next question - host controls the flow
          setCurrentQuestion(message.question);
          setQuestionIndex(message.questionIndex);
          setTotalQuestions(message.totalQuestions);
          const nextQuestionTime = message.question?.timePerQuestion || 10;
          setTimePerQuestion(nextQuestionTime);
          setSelectedAnswer(null);
          setHasAnswered(false);
          setHasSubmitted(false);
          setShowResult(false);
          break;
        case 'quiz-finished':
          // Always navigate to leaderboard when quiz is finished
          // Small delay to ensure server has processed the quiz finish
          setTimeout(() => {
            navigate(`/leaderboard?room=${roomCode}&host=${isHost}&player=${playerId}`);
          }, 500);
          break;
        case 'player-joined':
          setParticipants(message.players?.length || 0);
          break;
      }
    },
    onConnect: () => {
      if (roomCode && playerId) {
        sendMessage({
          type: 'join-room',
          roomCode,
          playerId,
          isHost,
        });
      }
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async (answerIndex: number) => {
      if (!currentQuestion?.id) {
        throw new Error('No question available');
      }
      const response = await apiRequest("POST", "/api/quiz/answer", {
        playerId,
        questionId: currentQuestion.id,
        selectedAnswer: answerIndex,
        timeToAnswer: timePerQuestion - timeLeft,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setLastResult(data);
      setShowResult(true);
      setHasAnswered(true);
      
      // Show notification only for correct answers
      if (data.isCorrect) {
        toast({
          title: "Correct!",
          description: `+${data.points} points`,
        });
      }
    },
    onError: (error) => {
      console.error('Answer submission error:', error);
      toast({
        title: "Error",
        description: error.message || 'Failed to submit answer',
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (roomCode && playerId) {
      connect();
    }
  }, [roomCode, playerId, isHost, connect]);

  // Timer countdown
  useEffect(() => {
    
    // Only run timer if there's a valid question and we haven't answered yet
    if (timeLeft > 0 && !hasAnswered && !hasSubmitted && questionIndex >= 0 && currentQuestion) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => {
        clearTimeout(timer);
      };
    } else if (timeLeft === 0 && !hasAnswered && !hasSubmitted && questionIndex >= 0 && currentQuestion && !submitAnswerMutation.isPending) {
      // Time's up - auto submit default answer (option 0) for everyone who hasn't answered
      setHasSubmitted(true);
      setSelectedAnswer(0); // Set default answer to option 0
      submitAnswerMutation.mutate(0);
    }
  }, [timeLeft, hasAnswered, hasSubmitted, questionIndex, currentQuestion, submitAnswerMutation.isPending]);

  // Complete state reset when question changes
  useEffect(() => {
    if (currentQuestion && timePerQuestion > 0) {
      
      // Always reset state when question changes
      setTimeLeft(timePerQuestion);
      setHasSubmitted(false);
      setHasAnswered(false);
      setSelectedAnswer(null);
      setShowResult(false);
      prevQuestionIndexRef.current = questionIndex;
      
    }
  }, [currentQuestion?.id]); // Only depend on question ID changes

  // Force state reset on component mount or when quiz status changes
  useEffect(() => {
    if (currentQuestion && timePerQuestion > 0) {
      
      // Clear server-side answers for this player to allow fresh attempts
      const clearAnswers = async () => {
        try {
          await fetch('/api/quiz/clear-answers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playerId }),
          });
        } catch (error) {
          console.error('Failed to clear answers:', error);
        }
      };
      
      clearAnswers();
      
      // Reset all state immediately
      setTimeLeft(timePerQuestion);
      setHasSubmitted(false);
      setHasAnswered(false);
      setSelectedAnswer(null);
      setShowResult(false);
      
    }
  }, [roomData?.room?.status, currentQuestion?.id]); // Trigger on quiz status or question changes

  const handleAnswerSelect = (answerIndex: number) => {
    
    if (hasAnswered || hasSubmitted || submitAnswerMutation.isPending || timeLeft === 0) {
      return;
    }
    
    setSelectedAnswer(answerIndex);
    setHasSubmitted(true);
    submitAnswerMutation.mutate(answerIndex);
  };

  const handleNextQuestion = () => {
    if (questionIndex + 1 < totalQuestions) {
      sendMessage({
        type: 'next-question',
        roomCode,
        playerId,
        isHost,
      });
    } else {
      sendMessage({
        type: 'quiz-finished',
        roomCode,
        playerId,
        isHost,
      });
    }
  };

  // Auto-advance for host only after showing results for full duration
  useEffect(() => {
    if (showResult && hasAnswered && isHost && hasSubmitted) {
      const timer = setTimeout(() => {
        handleNextQuestion();
      }, 3000); // Show results for 3 seconds
      return () => {
        clearTimeout(timer);
      };
    }
  }, [isHost, showResult, hasAnswered, hasSubmitted, questionIndex, totalQuestions]);

  const getOptionColors = (index: number) => {
    const colors = [
      'from-red-50 to-red-100 border-red-200 hover:from-red-100 hover:to-red-200',
      'from-blue-50 to-blue-100 border-blue-200 hover:from-blue-100 hover:to-blue-200',
      'from-green-50 to-green-100 border-green-200 hover:from-green-100 hover:to-green-200',
      'from-purple-50 to-purple-100 border-purple-200 hover:from-purple-100 hover:to-purple-200',
    ];
    return colors[index] || colors[0];
  };

  const getOptionButtonColors = (index: number) => {
    const colors = [
      'bg-red-500',
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
    ];
    return colors[index] || colors[0];
  };



  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-indigo-500 animate-pulse" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">
              {isConnected ? 'Waiting for Quiz to Start...' : 'Connecting...'}
            </h2>
            <p className="text-gray-600">
              {isConnected 
                ? 'The host will start the quiz shortly.' 
                : 'Please wait while we connect to the quiz server.'
              }
            </p>
            {!isConnected && (
              <div className="mt-4">
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse mx-auto"></div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4" key={`quiz-${currentQuestion?.id}-${questionIndex}`}>
      <div className="max-w-4xl mx-auto">
        {/* Quiz Header */}
        <Card className="bg-white rounded-3xl shadow-2xl mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center mr-3 md:mr-4">
                  <Brain className="text-white w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-gray-800">Quiz Room: {roomCode}</h2>
                  <p className="text-sm md:text-base text-gray-600">Question {questionIndex + 1} of {totalQuestions}</p>
                </div>
              </div>
              
              {/* Timer */}
              <div className="flex items-center justify-center md:justify-end">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg md:text-xl">{timeLeft}</span>
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mt-4">
              <Progress value={((questionIndex + 1) / totalQuestions) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Question Card */}
        <Card className="bg-white rounded-3xl shadow-2xl mb-6">
          <CardContent className="p-4 md:p-8">
            <h3 className="text-lg md:text-2xl lg:text-3xl font-bold text-gray-800 mb-6 md:mb-8 text-center leading-tight px-2">
              {currentQuestion.questionText}
            </h3>
            
            {/* Answer Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {currentQuestion.options.map((option, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className={`
                    bg-gradient-to-r ${getOptionColors(index)} 
                    border-2 rounded-2xl p-4 md:p-6 lg:p-8 text-left transition-all duration-300 transform hover:scale-105 hover:shadow-lg h-auto min-h-[120px] md:min-h-[140px] lg:min-h-[160px]
                    ${selectedAnswer === index ? 'ring-4 ring-indigo-300' : ''}
                    ${showResult && index === currentQuestion.correctAnswer ? 'ring-4 ring-green-400' : ''}
                    ${showResult && selectedAnswer === index && index !== currentQuestion.correctAnswer ? 'ring-4 ring-red-400' : ''}
                  `}
                  onClick={() => {
                    handleAnswerSelect(index);
                  }}
                  disabled={hasAnswered || hasSubmitted || timeLeft === 0}
                >
                  <div className="flex items-start w-full h-full">
                    <div className={`w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 ${getOptionButtonColors(index)} rounded-lg flex items-center justify-center mr-3 md:mr-4 lg:mr-5 flex-shrink-0 mt-1`}>
                      <span className="text-white font-bold text-base md:text-lg lg:text-xl">{String.fromCharCode(65 + index)}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <span className="text-sm md:text-base lg:text-lg font-medium text-gray-800 leading-relaxed break-words hyphens-auto">{option}</span>
                    </div>
                    {showResult && index === currentQuestion.correctAnswer && (
                      <CheckCircle className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-green-500 ml-2 md:ml-3 flex-shrink-0" />
                    )}
                    {showResult && selectedAnswer === index && index !== currentQuestion.correctAnswer && (
                      <XCircle className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 text-red-500 ml-2 md:ml-3 flex-shrink-0" />
                    )}
                  </div>
                </Button>
              ))}
            </div>

            {/* Result Display */}
            {showResult && lastResult && (
              <div className="mt-6 p-4 bg-gray-50 rounded-2xl text-center">
                <p className="text-lg font-semibold text-gray-800">
                  {lastResult.isCorrect ? 'Correct!' : 'Incorrect'}
                </p>
                <p className="text-gray-600">
                  {lastResult.isCorrect ? `+${lastResult.points} points` : 'Better luck next time!'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Total Score: {lastResult.totalScore}
                </p>
              </div>
            )}

            {/* Host Controls */}
            {isHost && hasAnswered && (
              <div className="mt-6 text-center">
                <Button
                  onClick={handleNextQuestion}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-indigo-600 hover:to-violet-700 transition-all duration-300"
                >
                  {questionIndex + 1 < totalQuestions ? 'Next Question' : 'Finish Quiz'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connection Status and Participants Count */}
        <Card className="bg-white rounded-2xl shadow-lg">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center space-x-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-gray-600" />
                <span className="text-gray-600">
                  {participants || 'Multiple'} participants
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
