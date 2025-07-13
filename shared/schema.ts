import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const quizRooms = pgTable("quiz_rooms", {
  id: serial("id").primaryKey(),
  roomCode: text("room_code").notNull().unique(),
  hostId: text("host_id").notNull(),
  topic: text("topic").notNull(),
  questionCount: integer("question_count").notNull().default(10),
  timePerQuestion: integer("time_per_question").notNull().default(10),
  status: text("status").notNull().default("waiting"), // waiting, active, finished
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  questionText: text("question_text").notNull(),
  options: jsonb("options").notNull(), // Array of 4 options
  correctAnswer: integer("correct_answer").notNull(), // Index of correct option (0-3)
  order: integer("order").notNull(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  name: text("name").notNull(),
  playerId: text("player_id").notNull().unique(),
  score: integer("score").notNull().default(0),
  isHost: boolean("is_host").notNull().default(false),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const answers = pgTable("answers", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  questionId: integer("question_id").notNull(),
  selectedAnswer: integer("selected_answer").notNull(),
  isCorrect: boolean("is_correct").notNull(),
  timeToAnswer: integer("time_to_answer").notNull(), // in seconds
  answeredAt: timestamp("answered_at").defaultNow(),
});

export const insertQuizRoomSchema = createInsertSchema(quizRooms).omit({
  id: true,
  createdAt: true,
});

export const insertQuestionSchema = createInsertSchema(questions).omit({
  id: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
  joinedAt: true,
});

export const insertAnswerSchema = createInsertSchema(answers).omit({
  id: true,
  answeredAt: true,
});

export type QuizRoom = typeof quizRooms.$inferSelect;
export type InsertQuizRoom = z.infer<typeof insertQuizRoomSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Player = typeof players.$inferSelect;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;

// Additional schemas for API requests
export const createQuizSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  questionCount: z.number().min(5).max(20).default(10),
  timePerQuestion: z.number().min(10).max(60).default(10),
  hostId: z.string().min(1, "Host ID is required"),
});

export const joinQuizSchema = z.object({
  roomCode: z.string().length(6, "Room code must be 6 characters"),
  name: z.string().min(1, "Name is required"),
  playerId: z.string().min(1, "Player ID is required"),
});

export const submitAnswerSchema = z.object({
  playerId: z.string().min(1, "Player ID is required"),
  questionId: z.number().min(1, "Question ID is required"),
  selectedAnswer: z.number().min(0).max(3, "Answer must be between 0-3"),
  timeToAnswer: z.number().min(0, "Time to answer must be positive"),
});

export const cleanupRoomSchema = z.object({
  playerId: z.string().min(1, "Player ID is required"),
  isHost: z.boolean().refine(val => val === true, "Only host can cleanup room"),
});

export const leaveRoomSchema = z.object({
  playerId: z.string().min(1, "Player ID is required"),
  roomCode: z.string().length(6, "Room code must be 6 characters"),
});

export type CreateQuizRequest = z.infer<typeof createQuizSchema>;
export type JoinQuizRequest = z.infer<typeof joinQuizSchema>;
export type SubmitAnswerRequest = z.infer<typeof submitAnswerSchema>;
export type CleanupRoomRequest = z.infer<typeof cleanupRoomSchema>;
export type LeaveRoomRequest = z.infer<typeof leaveRoomSchema>;
