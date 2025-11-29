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
  advanceToNextRound,
} = require('./sessions');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: '*' },
});


app.use(express.static('public'));

function generateSessionId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}


async function handleRoundEnd(sessionId) {
  const shouldContinue = await advanceToNextRound(sessionId);
  if (shouldContinue) {
    const session = await getSession(sessionId);
    io.to(sessionId).emit('nextRound', {
      round: session.currentRound,
      gameMaster: session.gameMaster,
      players: session.players,
    });
  } else {
    const session = await getSession(sessionId);
    const winner = session.players.reduce((prev, current) =>
      (prev.score > current.score) ? prev : current
    );
    io.to(sessionId).emit('gameOver', { winner, players: session.players });
    setTimeout(() => deleteSession(sessionId), 300000);
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createGame', async (data) => {
    const { error, value } = createGameSchema.validate(data);
    if (error) return socket.emit('error', { message: error.details[0].message });

    const sessionId = generateSessionId();
    await createSession(sessionId, socket.id, value.playerName); 
    socket.join(sessionId);
    socket.emit('gameCreated', { sessionId, playerName: value.playerName });
    
    const session = await getSession(sessionId); 
    io.to(sessionId).emit('updatePlayers', { players: session.players });
  });

  socket.on('joinGame', async (data) => {
    const { error, value } = joinGameSchema.validate(data);
    if (error) return socket.emit('error', { message: error.details[0].message });

    const session = await getSession(value.sessionId); 
    if (!session || session.status !== 'waiting') {
      return socket.emit('error', { message: 'Session not found or already started.' });
    }

    const success = await addPlayer(value.sessionId, socket.id, value.playerName); 
    if (success) {
      socket.join(value.sessionId);
      const updatedSession = await getSession(value.sessionId); 
      io.to(value.sessionId).emit('updatePlayers', { players: updatedSession.players });
      socket.emit('joinedGame', { sessionId: value.sessionId });
    } else {
      socket.emit('error', { message: 'Failed to join session.' });
    }
  });

  socket.on('submitQuestion', async (data) => { 
    const session = await getSession(data.sessionId);
    if (!session || session.gameMaster.id !== socket.id || session.status !== 'waiting') {
      return socket.emit('error', { message: 'Only game master can submit question.' });
    }

    const { error, value } = submitQuestionSchema.validate(data);
    if (error) return socket.emit('error', { message: error.details[0].message });

    await setQuestion(data.sessionId, value.question, value.answer); // ✅ await
    io.to(data.sessionId).emit('questionReady');
  });

  socket.on('startGame', async (data) => { 
    const session = await getSession(data.sessionId);
    if (!session || session.gameMaster.id !== socket.id) {
      return socket.emit('error', { message: 'Only game master can start.' });
    }

    const success = await startGame(data.sessionId); 
    if (!success) {
      return socket.emit('error', { message: 'Need at least 3 players to start.' });
    }

    const startedSession = await getSession(data.sessionId);
    io.to(data.sessionId).emit('gameStarted', { question: startedSession.question });
  });

  socket.on('submitGuess', async (data) => { 
    const session = await getSession(data.sessionId);
    if (!session || session.status !== 'active') return;

    const player = session.players.find(p => p.id === socket.id);
    if (!player) return;

   
    const elapsed = Date.now() - session.startTime;
    if (elapsed > 60000) {
      return socket.emit('error', { message: 'Time is up!' });
    }

    const { error, value } = submitGuessSchema.validate(data);
    if (error) return socket.emit('error', { message: error.details[0].message });

    const cleanGuess = value.guess.toLowerCase().trim();
    if (cleanGuess === session.answer) {
      await endGame(data.sessionId, 'correct', socket.id); 
      const finalSession = await getSession(data.sessionId);
      const winner = finalSession.players.find(p => p.id === socket.id); 
      io.to(data.sessionId).emit('gameEnded', {
        winner,
        answer: finalSession.answer,
        reason: 'correct',
      });
      
      setTimeout(() => handleRoundEnd(data.sessionId), 3000);
    } else {
      socket.emit('guessResult', { correct: false });
    }
  });


  socket.on('typingStart', (data) => {
    socket.to(data.sessionId).emit('userTyping', { playerId: socket.id });
  });

  socket.on('disconnect', async () => {

    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});