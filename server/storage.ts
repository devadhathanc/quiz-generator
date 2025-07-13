import {
  quizRooms,
  questions,
  players,
  answers,
  type QuizRoom,
  type Question,
  type Player,
  type Answer,
  type InsertQuizRoom,
  type InsertQuestion,
  type InsertPlayer,
  type InsertAnswer,
} from "@shared/schema";

export interface IStorage {
  // Quiz Room operations
  createQuizRoom(room: InsertQuizRoom): Promise<QuizRoom>;
  getQuizRoomByCode(roomCode: string): Promise<QuizRoom | undefined>;
  getQuizRoomByPlayerId(playerId: string): Promise<QuizRoom | undefined>;
  updateQuizRoom(roomCode: string, updates: Partial<QuizRoom>): Promise<QuizRoom | undefined>;
  deleteQuizRoom(roomCode: string): Promise<boolean>;

  // Question operations
  createQuestions(questions: InsertQuestion[]): Promise<Question[]>;
  getQuestionsByRoomId(roomId: number): Promise<Question[]>;
  getQuestionByRoomAndOrder(roomId: number, order: number): Promise<Question | undefined>;
  getQuestionById(questionId: number): Promise<Question | undefined>;

  // Player operations
  createPlayer(player: InsertPlayer): Promise<Player>;
  getPlayersByRoomId(roomId: number): Promise<Player[]>;
  getPlayerById(playerId: string): Promise<Player | undefined>;
  updatePlayerScore(playerId: string, score: number): Promise<Player | undefined>;
  deletePlayer(playerId: string): Promise<boolean>;

  // Answer operations
  createAnswer(answer: InsertAnswer): Promise<Answer>;
  getAnswersByQuestionId(questionId: number): Promise<Answer[]>;
  getAnswersByPlayerId(playerId: string): Promise<Answer[]>;
  hasPlayerAnswered(playerId: string, questionId: number): Promise<boolean>;
  clearAnswersForPlayer(playerId: string): Promise<boolean>;

  // Cleanup operations
  cleanupRoom(roomCode: string): Promise<boolean>;
  cleanupPlayer(playerId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private quizRooms: Map<string, QuizRoom> = new Map();
  private questions: Map<number, Question> = new Map();
  private players: Map<string, Player> = new Map();
  private answers: Map<number, Answer> = new Map();
  private currentRoomId = 1;
  private currentQuestionId = 1;
  private currentPlayerId = 1;
  private currentAnswerId = 1;

  async createQuizRoom(room: InsertQuizRoom): Promise<QuizRoom> {
    const newRoom: QuizRoom = {
      id: this.currentRoomId++,
      roomCode: room.roomCode,
      hostId: room.hostId,
      topic: room.topic,
      questionCount: room.questionCount || 10,
      timePerQuestion: room.timePerQuestion || 10,
      status: room.status || 'waiting',
      currentQuestionIndex: room.currentQuestionIndex || 0,
      createdAt: new Date(),
    };
    this.quizRooms.set(room.roomCode, newRoom);
    return newRoom;
  }

  async getQuizRoomByCode(roomCode: string): Promise<QuizRoom | undefined> {
    return this.quizRooms.get(roomCode);
  }

  async getQuizRoomByPlayerId(playerId: string): Promise<QuizRoom | undefined> {
    const player = this.players.get(playerId);
    if (!player) return undefined;
    
    return Array.from(this.quizRooms.values())
      .find(room => room.id === player.roomId);
  }

  async updateQuizRoom(roomCode: string, updates: Partial<QuizRoom>): Promise<QuizRoom | undefined> {
    const room = this.quizRooms.get(roomCode);
    if (!room) return undefined;
    
    const updatedRoom = { ...room, ...updates };
    this.quizRooms.set(roomCode, updatedRoom);
    return updatedRoom;
  }

  async deleteQuizRoom(roomCode: string): Promise<boolean> {
    return this.quizRooms.delete(roomCode);
  }

  async createQuestions(questionList: InsertQuestion[]): Promise<Question[]> {
    const createdQuestions: Question[] = [];
    
    for (const question of questionList) {
      const newQuestion: Question = {
        ...question,
        id: this.currentQuestionId++,
      };
      this.questions.set(newQuestion.id, newQuestion);
      createdQuestions.push(newQuestion);
    }
    
    return createdQuestions;
  }

  async getQuestionsByRoomId(roomId: number): Promise<Question[]> {
    return Array.from(this.questions.values())
      .filter(q => q.roomId === roomId)
      .sort((a, b) => a.order - b.order);
  }

  async getQuestionByRoomAndOrder(roomId: number, order: number): Promise<Question | undefined> {
    return Array.from(this.questions.values())
      .find(q => q.roomId === roomId && q.order === order);
  }

  async getQuestionById(questionId: number): Promise<Question | undefined> {
    return this.questions.get(questionId);
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const newPlayer: Player = {
      id: this.currentPlayerId++,
      roomId: player.roomId,
      name: player.name,
      playerId: player.playerId,
      score: player.score || 0,
      isHost: player.isHost || false,
      joinedAt: new Date(),
    };
    this.players.set(player.playerId, newPlayer);
    return newPlayer;
  }

  async getPlayersByRoomId(roomId: number): Promise<Player[]> {
    return Array.from(this.players.values())
      .filter(p => p.roomId === roomId)
      .sort((a, b) => b.score - a.score);
  }

  async getPlayerById(playerId: string): Promise<Player | undefined> {
    return this.players.get(playerId);
  }

  async updatePlayerScore(playerId: string, score: number): Promise<Player | undefined> {
    const player = this.players.get(playerId);
    if (!player) return undefined;
    
    const updatedPlayer = { ...player, score };
    this.players.set(playerId, updatedPlayer);
    return updatedPlayer;
  }

  async deletePlayer(playerId: string): Promise<boolean> {
    return this.players.delete(playerId);
  }

  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const newAnswer: Answer = {
      ...answer,
      id: this.currentAnswerId++,
      answeredAt: new Date(),
    };
    this.answers.set(newAnswer.id, newAnswer);
    return newAnswer;
  }

  async getAnswersByQuestionId(questionId: number): Promise<Answer[]> {
    return Array.from(this.answers.values())
      .filter(a => a.questionId === questionId);
  }

  async getAnswersByPlayerId(playerId: string): Promise<Answer[]> {
    return Array.from(this.answers.values())
      .filter(a => a.playerId === playerId);
  }

  async hasPlayerAnswered(playerId: string, questionId: number): Promise<boolean> {
    return Array.from(this.answers.values())
      .some(a => a.playerId === playerId && a.questionId === questionId);
  }

  async clearAnswersForPlayer(playerId: string): Promise<boolean> {
    const answersToDelete = Array.from(this.answers.values())
      .filter(a => a.playerId === playerId);
    
    answersToDelete.forEach(answer => {
      this.answers.delete(answer.id);
    });
    
    return true;
  }

  async cleanupRoom(roomCode: string): Promise<boolean> {
    
    const room = this.quizRooms.get(roomCode);
    if (!room) {
      return false;
    }

    
    // Delete all players in the room
    const roomPlayers = Array.from(this.players.values())
      .filter(p => p.roomId === room.id);
    
    
    for (const player of roomPlayers) {
      this.players.delete(player.playerId);
    }

    // Delete all questions in the room
    const roomQuestions = Array.from(this.questions.values())
      .filter(q => q.roomId === room.id);
    
    
    for (const question of roomQuestions) {
      this.questions.delete(question.id);
    }

    // Delete all answers for questions in the room
    let answerCount = 0;
    for (const question of roomQuestions) {
      const questionAnswers = Array.from(this.answers.values())
        .filter(a => a.questionId === question.id);
      
      answerCount += questionAnswers.length;
      for (const answer of questionAnswers) {
        this.answers.delete(answer.id);
      }
    }
    
    // Finally delete the room
    const roomDeleted = this.quizRooms.delete(roomCode);
    
    return roomDeleted;
  }

  async cleanupPlayer(playerId: string): Promise<boolean> {
    
    const player = this.players.get(playerId);
    if (!player) {
      return false;
    }

    // Delete all answers by this player
    const playerAnswers = Array.from(this.answers.values())
      .filter(a => a.playerId === playerId);
    
    
    for (const answer of playerAnswers) {
      this.answers.delete(answer.id);
    }

    // Delete the player
    const playerDeleted = this.players.delete(playerId);
    
    return playerDeleted;
  }
}

export const storage = new MemStorage();
