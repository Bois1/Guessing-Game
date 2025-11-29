const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const {
  createGameSchema,
  joinGameSchema,
  submitQuestionSchema,
  submitGuessSchema,
} = require('./utils/validate');
const {
  createSession,
  getSession,
  addPlayer,
  setQuestion,
  startGame,
  endGame,
  deleteSession,
  cleanupEmptySessions,
} = require('./sessions');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' },
});


function generateSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);


  socket.on('createGame', async (data) => {
    const { error, value } = createGameSchema.validate(data);
    if (error) return socket.emit('error', { message: error.details[0].message });

    const sessionId = generateSessionId();
    createSession(sessionId, socket.id, value.playerName);
    socket.join(sessionId);
    socket.emit('gameCreated', { sessionId, playerName: value.playerName });
    io.to(sessionId).emit('updatePlayers', { players: getSession(sessionId).players });
  });

  
  socket.on('joinGame', async (data) => {
    const { error, value } = joinGameSchema.validate(data);
    if (error) return socket.emit('error', { message: error.details[0].message });

    const session = getSession(value.sessionId);
    if (!session || session.status !== 'waiting') {
      return socket.emit('error', { message: 'Session not found or already started.' });
    }

    if (addPlayer(value.sessionId, socket.id, value.playerName)) {
      socket.join(value.sessionId);
      io.to(value.sessionId).emit('updatePlayers', { players: session.players });
      socket.emit('joinedGame', { sessionId: value.sessionId });
    } else {
      socket.emit('error', { message: 'Failed to join session.' });
    }
  });

 
  socket.on('submitQuestion', (data) => {
    const session = getSession(data.sessionId);
    if (!session || session.gameMaster.id !== socket.id || session.status !== 'waiting') {
      return socket.emit('error', { message: 'Only game master can submit question.' });
    }

    const { error, value } = submitQuestionSchema.validate(data);
    if (error) return socket.emit('error', { message: error.details[0].message });

    setQuestion(data.sessionId, value.question, value.answer);
    io.to(data.sessionId).emit('questionReady');
  });


  socket.on('startGame', (data) => {
    const session = getSession(data.sessionId);
    if (!session || session.gameMaster.id !== socket.id) {
      return socket.emit('error', { message: 'Only game master can start.' });
    }

    if (!startGame(data.sessionId)) {
      return socket.emit('error', { message: 'Need at least 3 players to start.' });
    }

    io.to(data.sessionId).emit('gameStarted', { question: session.question });
  });


  socket.on('submitGuess', (data) => {
    const session = getSession(data.sessionId);
    if (!session || session.status !== 'active') return;

    const player = session.players.find(p => p.id === socket.id);
    if (!player) return;

    
    if (session.status !== 'active') return;

    const { error, value } = submitGuessSchema.validate(data);
    if (error) return socket.emit('error', { message: error.details[0].message });

    const cleanGuess = value.guess.toLowerCase().trim();
    if (cleanGuess === session.answer) {
  
      endGame(data.sessionId, 'correct', socket.id);
      const winner = session.players.find(p => p.id === socket.id);
      io.to(data.sessionId).emit('gameEnded', {
        winner: winner,
        answer: session.answer,
        reason: 'correct',
      });
    } else {
   
      socket.emit('guessResult', { correct: false });
    }
  });

  
  socket.on('disconnect', () => {

    for (const [sessionId, session] of getSessionEntries()) {
      const index = session.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        session.players.splice(index, 1);

  
        if (session.status === 'waiting' && session.gameMaster.id === socket.id && session.players.length > 0) {
          session.gameMaster = { ...session.players[0] };
          io.to(sessionId).emit('newGameMaster', { gameMaster: session.gameMaster });
        }

        io.to(sessionId).emit('updatePlayers', { players: session.players });

   
        if (session.players.length === 0) {
          deleteSession(sessionId);
        }
      }
    }
    cleanupEmptySessions();
  });
});


function* getSessionEntries() {
  for (const entry of require('./sessions').sessions.entries()) {
    yield entry;
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});