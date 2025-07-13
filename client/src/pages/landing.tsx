import { Link } from "wouter";
import { Brain, Crown, Users, Bot, Zap, Trophy } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fadeIn">
      <div className="max-w-4xl w-full text-center">
        {/* Logo and Title */}
        <div className="mb-12 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl mb-6 shadow-xl">
            <Brain className="text-white w-8 h-8" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent mb-4">
            QuizGen
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered quiz generator that creates engaging questions from any topic. Host interactive quiz sessions with real-time participation.
          </p>
        </div>

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Host Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Crown className="text-white w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Host a Quiz</h3>
            <p className="text-gray-600 mb-6">Create AI-generated questions from your prompt and manage quiz sessions with real-time participants.</p>
            <Link href="/host" className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-semibold py-4 px-8 rounded-xl hover:from-indigo-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg inline-block">
              Start as Host
            </Link>
          </div>

          {/* Player Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Users className="text-white w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Join a Quiz</h3>
            <p className="text-gray-600 mb-6">Enter a room code to join an existing quiz session and compete with other participants.</p>
            <Link href="/player" className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white font-semibold py-4 px-8 rounded-xl hover:from-violet-600 hover:to-violet-700 transition-all duration-300 transform hover:scale-105 shadow-lg inline-block">
              Join as Player
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 animate-fadeIn">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
            <Bot className="text-indigo-500 w-8 h-8 mb-4 mx-auto" />
            <h4 className="font-semibold text-gray-800 mb-2">AI-Generated Questions</h4>
            <p className="text-gray-600 text-sm">Create questions from any topic using advanced AI technology</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
            <Zap className="text-emerald-500 w-8 h-8 mb-4 mx-auto" />
            <h4 className="font-semibold text-gray-800 mb-2">Real-time Participation</h4>
            <p className="text-gray-600 text-sm">Instant updates and synchronized quiz experience</p>
          </div>
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
            <Trophy className="text-amber-500 w-8 h-8 mb-4 mx-auto" />
            <h4 className="font-semibold text-gray-800 mb-2">Interactive Leaderboard</h4>
            <p className="text-gray-600 text-sm">Track scores and celebrate winners with live rankings</p>
          </div>
        </div>
      </div>
    </div>
  );
}
