import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generateQuizQuestions } from "./services/openai";
import {
  createQuizSchema,
  joinQuizSchema,
  submitAnswerSchema,
  cleanupRoomSchema,
  leaveRoomSchema,
  type CreateQuizRequest,
  type JoinQuizRequest,
  type SubmitAnswerRequest,
  type CleanupRoomRequest,
  type LeaveRoomRequest,
} from "@shared/schema";

interface WebSocketClient extends WebSocket {
  roomCode?: string;
  playerId?: string;
  isHost?: boolean;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server for real-time communication
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<string, WebSocketClient>();

  // WebSocket connection handling
  wss.on('connection', (ws: WebSocketClient) => {
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'join-room':
            ws.roomCode = data.roomCode;
            ws.playerId = data.playerId;
            ws.isHost = data.isHost;
            clients.set(data.playerId, ws);
            
            // Get room to get roomId if not provided
            const room = await storage.getQuizRoomByCode(data.roomCode);
            if (room) {
              // Broadcast player joined to room
              broadcastToRoom(data.roomCode, {
                type: 'player-joined',
                players: await storage.getPlayersByRoomId(room.id)
              }, data.playerId);
            } else {
              // console.log('❌ Room not found for code:', data.roomCode);
            }
            break;

          case 'leave-room':
            
            // Clean up player data
            await storage.cleanupPlayer(data.playerId);
            
            // Remove from WebSocket clients
            clients.delete(data.playerId);
            
            // Broadcast player left to room
            const leaveRoom = await storage.getQuizRoomByCode(data.roomCode);
            if (leaveRoom) {
              broadcastToRoom(data.roomCode, {
                type: 'player-left',
                playerId: data.playerId,
                players: await storage.getPlayersByRoomId(leaveRoom.id)
              });
            }
            break;

          case 'cleanup-room':
            
            if (data.isHost) {
              // Clean up entire room
              await storage.cleanupRoom(data.roomCode);
              
              // Disconnect all clients in the room
              const roomClients = Array.from(clients.entries())
                .filter(([_, client]) => client.roomCode === data.roomCode);
              
              for (const [playerId, client] of roomClients) {
                client.send(JSON.stringify({
                  type: 'room-closed',
                  message: 'Room has been closed by the host'
                }));
                client.close();
                clients.delete(playerId);
              }
              
            } else {
              // console.log('❌ Non-host tried to cleanup room:', data.playerId);
            }
            break;
            
          case 'start-quiz':
            
            if (data.isHost) {
              const room = await storage.getQuizRoomByCode(data.roomCode);
              if (room) {
                // console.log('📋 Room found, updating status to active');
                await storage.updateQuizRoom(data.roomCode, { status: 'active' });
                const questions = await storage.getQuestionsByRoomId(room.id);
                const firstQuestion = questions[0];
                
                // Broadcast to ALL players in the room, including the host
                const message = {
                  type: 'quiz-started',
                  question: {
                    ...firstQuestion,
                    timePerQuestion: room.timePerQuestion || 10
                  },
                  questionIndex: 0,
                  totalQuestions: questions.length
                };
                broadcastToRoom(data.roomCode, message, undefined); // Don't exclude anyone
              } else {
                // console.log('❌ Room not found for code:', data.roomCode);
              }
            } else {
              // console.log('❌ Non-host tried to start quiz:', data.playerId);
            }
            break;
            
          case 'next-question':
            
            if (data.isHost) {
              const room = await storage.getQuizRoomByCode(data.roomCode);
              if (room) {
                const nextIndex = room.currentQuestionIndex + 1;
                const questions = await storage.getQuestionsByRoomId(room.id);
                
                if (nextIndex < questions.length) {
                  await storage.updateQuizRoom(data.roomCode, { currentQuestionIndex: nextIndex });
                  broadcastToRoom(data.roomCode, {
                    type: 'next-question',
                    question: {
                      ...questions[nextIndex],
                      timePerQuestion: room.timePerQuestion || 10
                    },
                    questionIndex: nextIndex,
                    totalQuestions: questions.length
                  });
                } else {
                  // Quiz finished
                  // console.log('🏁 Quiz finished, updating room status and broadcasting');
                  await storage.updateQuizRoom(data.roomCode, { status: 'finished' });
                  const players = await storage.getPlayersByRoomId(room.id);
                  broadcastToRoom(data.roomCode, {
                    type: 'quiz-finished',
                    leaderboard: players.sort((a, b) => b.score - a.score)
                  });
                }
              }
            }
            break;
            
          case 'quiz-finished':
            
            if (data.isHost) {
              const room = await storage.getQuizRoomByCode(data.roomCode);
              if (room) {
                // console.log('📋 Room found, updating status to finished');
                await storage.updateQuizRoom(data.roomCode, { status: 'finished' });
                const players = await storage.getPlayersByRoomId(room.id);
                const leaderboard = players.sort((a, b) => b.score - a.score);
                broadcastToRoom(data.roomCode, {
                  type: 'quiz-finished',
                  leaderboard: leaderboard
                });
              } else {
                // console.log('❌ Room not found for code:', data.roomCode);
              }
            } else {
              // console.log('❌ Non-host tried to finish quiz:', data.playerId);
            }
            break;
        }
      } catch (error) {
        // console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (ws.playerId) {
        clients.delete(ws.playerId);
      }
    });
  });

  function broadcastToRoom(roomCode: string, message: any, excludePlayerId?: string) {
    clients.forEach((client, playerId) => {
      if (client.roomCode === roomCode && 
          client.readyState === WebSocket.OPEN &&
          (excludePlayerId === undefined || playerId !== excludePlayerId)) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // Generate random room code
  function generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // API Routes
  app.post('/api/quiz/create', async (req, res) => {
    try {
      const data = createQuizSchema.parse(req.body) as CreateQuizRequest;
      
      // Generate unique room code
      let roomCode: string;
      let attempts = 0;
      do {
        roomCode = generateRoomCode();
        attempts++;
      } while (await storage.getQuizRoomByCode(roomCode) && attempts < 10);
      
      if (attempts >= 10) {
        return res.status(500).json({ message: 'Failed to generate unique room code' });
      }

      // Create quiz room
      const room = await storage.createQuizRoom({
        roomCode,
        hostId: data.hostId,
        topic: data.topic,
        questionCount: data.questionCount,
        timePerQuestion: data.timePerQuestion,
        status: 'waiting',
        currentQuestionIndex: 0,
      });

      // Generate questions using OpenAI
      const generatedQuestions = await generateQuizQuestions(data.topic, data.questionCount);
      
      // Save questions to storage
      const questionsToInsert = generatedQuestions.map((q, index) => ({
        roomId: room.id,
        questionText: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        order: index,
      }));
      
      await storage.createQuestions(questionsToInsert);

      // Create host player
      await storage.createPlayer({
        roomId: room.id,
        name: 'Host',
        playerId: data.hostId,
        score: 0,
        isHost: true,
      });

      res.json({ 
        roomCode,
        room,
        message: 'Quiz created successfully'
      });
    } catch (error) {
      // console.error('Create quiz error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create quiz'
      });
    }
  });

  app.post('/api/quiz/join', async (req, res) => {
    try {
      const data = joinQuizSchema.parse(req.body) as JoinQuizRequest;
      
      const room = await storage.getQuizRoomByCode(data.roomCode);
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      if (room.status !== 'waiting') {
        return res.status(400).json({ message: 'Quiz has already started' });
      }

      // Check if player already exists in this specific room
      const existingPlayer = await storage.getPlayerById(data.playerId);
      if (existingPlayer && existingPlayer.roomId === room.id) {
        return res.status(400).json({ message: 'Player already joined this room' });
      }

      // If player exists in a different room, remove them first
      if (existingPlayer) {
        await storage.cleanupPlayer(data.playerId);
      }

      // Create player
      const player = await storage.createPlayer({
        roomId: room.id,
        name: data.name,
        playerId: data.playerId,
        score: 0,
        isHost: false,
      });

      const players = await storage.getPlayersByRoomId(room.id);

      res.json({
        player,
        room,
        players,
        message: 'Successfully joined quiz'
      });
    } catch (error) {
      // console.error('Join quiz error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to join quiz'
      });
    }
  });

  app.post('/api/quiz/clear-answers', async (req, res) => {
    try {
      const { playerId } = req.body;
      
      if (!playerId) {
        return res.status(400).json({ message: 'Player ID is required' });
      }

      await storage.clearAnswersForPlayer(playerId);
      
      res.json({ message: 'Answers cleared successfully' });
    } catch (error) {
      // console.error('Clear answers error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to clear answers'
      });
    }
  });

  app.post('/api/quiz/answer', async (req, res) => {
    try {
      const data = submitAnswerSchema.parse(req.body) as SubmitAnswerRequest;
      
      const player = await storage.getPlayerById(data.playerId);
      if (!player) {
        return res.status(404).json({ message: 'Player not found' });
      }

      // Check if already answered
      const hasAnswered = await storage.hasPlayerAnswered(data.playerId, data.questionId);
      if (hasAnswered) {
        return res.status(400).json({ message: 'Already answered this question' });
      }

      // Get question to check correct answer
      const question = await storage.getQuestionById(data.questionId);
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
      
      // Verify the question belongs to the player's room
      if (question.roomId !== player.roomId) {
        return res.status(400).json({ message: 'Question does not belong to this room' });
      }

      const isCorrect = data.selectedAnswer === question.correctAnswer;
      
      // Calculate score based on correctness and time
      let points = 0;
      if (isCorrect) {
        const room = await storage.getQuizRoomByPlayerId(data.playerId);
        const maxTime = room?.timePerQuestion || 10;
        const timeBonus = Math.max(0, maxTime - data.timeToAnswer);
        points = 100 + (timeBonus * 10); // Base 100 points + time bonus
      }

      // Create answer record
      await storage.createAnswer({
        playerId: data.playerId,
        questionId: question.id,
        selectedAnswer: data.selectedAnswer,
        isCorrect,
        timeToAnswer: data.timeToAnswer,
      });

      // Update player score
      const updatedPlayer = await storage.updatePlayerScore(data.playerId, player.score + points);

      res.json({
        isCorrect,
        points,
        totalScore: updatedPlayer?.score || 0,
        correctAnswer: question.correctAnswer,
        message: isCorrect ? 'Correct answer!' : 'Incorrect answer'
      });
    } catch (error) {
      // console.error('Submit answer error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to submit answer'
      });
    }
  });

  app.get('/api/quiz/:roomCode', async (req, res) => {
    try {
      const { roomCode } = req.params;
      
      const room = await storage.getQuizRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      const players = await storage.getPlayersByRoomId(room.id);
      const questions = await storage.getQuestionsByRoomId(room.id);

      res.json({
        room,
        players,
        questionCount: questions.length,
      });
    } catch (error) {
      // console.error('Get quiz error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get quiz'
      });
    }
  });

  app.get('/api/quiz/:roomCode/questions', async (req, res) => {
    try {
      const { roomCode } = req.params;
      
      const room = await storage.getQuizRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      const questions = await storage.getQuestionsByRoomId(room.id);
      res.json(questions);
    } catch (error) {
      // console.error('Get questions error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get questions'
      });
    }
  });

  app.get('/api/quiz/:roomCode/leaderboard', async (req, res) => {
    try {
      const { roomCode } = req.params;
      
      const room = await storage.getQuizRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      const players = await storage.getPlayersByRoomId(room.id);
      const questions = await storage.getQuestionsByRoomId(room.id);

      // Calculate detailed stats for each player
      const leaderboard = await Promise.all(
        players.map(async (player) => {
          const answers = await storage.getAnswersByPlayerId(player.playerId);
          const correctAnswers = answers.filter(a => a.isCorrect).length;
          
          return {
            ...player,
            correctAnswers,
            totalQuestions: questions.length,
            accuracy: questions.length > 0 ? (correctAnswers / questions.length) * 100 : 0,
          };
        })
      );

      res.json({
        leaderboard: leaderboard.sort((a, b) => b.score - a.score),
        room,
      });
    } catch (error) {
      // console.error('Get leaderboard error:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get leaderboard'
      });
    }
  });

  // Cleanup endpoints
  app.post('/api/quiz/:roomCode/cleanup', async (req, res) => {
    try {
      const { roomCode } = req.params;
      const data = cleanupRoomSchema.parse(req.body) as CleanupRoomRequest;
      
      const room = await storage.getQuizRoomByCode(roomCode);
      if (!room) {
        return res.status(404).json({ message: 'Room not found' });
      }

      if (room.hostId !== data.playerId) {
        return res.status(403).json({ message: 'Only the room host can cleanup' });
      }

      const success = await storage.cleanupRoom(roomCode);
      if (!success) {
        return res.status(500).json({ message: 'Failed to cleanup room' });
      }

      res.json({ message: 'Room cleaned up successfully' });
    } catch (error) {
      // console.error('❌ Cleanup room error:', error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid request data',
          details: error.message
        });
      }
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to cleanup room'
      });
    }
  });

  app.post('/api/quiz/player/leave', async (req, res) => {
    try {
      const data = leaveRoomSchema.parse(req.body) as LeaveRoomRequest;
      
      const player = await storage.getPlayerById(data.playerId);
      if (!player) {
        // Player doesn't exist, which means they're already cleaned up
        // This is not an error - it's the desired state
        return res.json({ message: 'Player already removed' });
      }

      const success = await storage.cleanupPlayer(data.playerId);
      if (!success) {
        return res.status(500).json({ message: 'Failed to remove player' });
      }

      res.json({ message: 'Player removed successfully' });
    } catch (error) {
      // console.error('❌ Leave player error:', error);
      if (error instanceof Error && error.name === 'ZodError') {
        return res.status(400).json({ 
          message: 'Invalid request data',
          details: error.message
        });
      }
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to remove player'
      });
    }
  });

  return httpServer;
}
