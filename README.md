# QuizMaster

A real-time multiplayer quiz application built with React, TypeScript, and WebSockets.

## Features

- 🎯 Real-time multiplayer quiz sessions
- 🏠 Host creates quiz rooms with custom topics
- 👥 Players join rooms with unique codes
- ⏰ Configurable timer per question
- 🏆 Live leaderboard with scores
- 🔄 Automatic question progression
- 📱 Responsive design for mobile and desktop

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, WebSockets
- **AI Integration**: OpenRouter API for question generation
- **State Management**: React Query, React Hooks
- **UI Components**: Custom components with shadcn/ui

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd QuizMaster
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to `http://localhost:5001`

## Usage

### For Hosts:
1. Go to the host page
2. Enter a topic and configure quiz settings
3. Share the room code with players
4. Start the quiz when ready

### For Players:
1. Go to the player page
2. Enter your name and the room code
3. Wait for the host to start the quiz
4. Answer questions within the time limit

## Project Structure

```
QuizMaster/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   └── lib/           # Utility functions
├── server/                # Backend Node.js application
│   ├── routes.ts          # API routes
│   ├── storage.ts         # In-memory data storage
│   └── services/          # External service integrations
└── shared/                # Shared types and schemas
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

