const { createClient } = require('redis');
const client = createClient();

client.on('error', (err) => console.log('Redis Client Error', err));

let redisConnected = false;
client.connect().then(() => {
  redisConnected = true;
  console.log('Connected to Redis');
});


function serializeSession(session) {
  const { timer, ...safeSession } = session;
  return JSON.stringify(safeSession);
}


function deserializeSession(str) {
  if (!str) return null;
  const session = JSON.parse(str);
  session.timer = null; 
  return session;
}


async function createSession(sessionId, gameMasterId, gameMasterName) {
  if (!redisConnected) return;
  const session = {
    id: sessionId,
    status: 'waiting',
    gameMaster: { id: gameMasterId, name: gameMasterName },
    players: [{ id: gameMasterId, name: gameMasterName, score: 0 }],
    question: null,
    answer: null,
    winner: null,
    startTime: null,
    currentRound: 1,
    maxRounds: 5,
    timer: null,
  };
  await client.setEx(`session:${sessionId}`, 3600, serializeSession(session));
}

async function getSession(sessionId) {
  if (!redisConnected) return null;
  const data = await client.get(`session:${sessionId}`);
  return deserializeSession(data);
}

async function updateSession(sessionId, updateFn) {
  if (!redisConnected) return;
  const session = await getSession(sessionId);
  if (!session) return;
  updateFn(session);
  await client.setEx(`session:${sessionId}`, 3600, serializeSession(session));
}

async function deleteSession(sessionId) {
  if (!redisConnected) return;
  await client.del(`session:${sessionId}`);
}


async function addPlayer(sessionId, playerId, playerName) {
  let success = false;
  await updateSession(sessionId, (session) => {
    if (session && session.status === 'waiting') {
      const exists = session.players.some(p => p.id === playerId);
      if (!exists) {
        session.players.push({ id: playerId, name: playerName, score: 0 });
        success = true;
      }
    }
  });
  return success;
}

async function setQuestion(sessionId, question, answer) {
  let success = false;
  await updateSession(sessionId, (session) => {
    if (session) {
      session.question = question;
      session.answer = answer.toLowerCase().trim();
      success = true;
    }
  });
  return success;
}

async function startGame(sessionId) {
  let success = false;
  await updateSession(sessionId, (session) => {
    if (session && session.status === 'waiting' && session.players.length >= 3) {
      session.status = 'active';
      session.startTime = Date.now();
      success = true;
    }
  });
  return success;
}

async function endGame(sessionId, reason, winnerId = null) {
  await updateSession(sessionId, (session) => {
    if (session && session.status === 'active') {
      session.status = 'ended';
      if (reason === 'correct' && winnerId) {
        const winner = session.players.find(p => p.id === winnerId);
        if (winner) {
          winner.score += 10;
          session.winner = winnerId;
        }
      }
    }
  });
}

async function advanceToNextRound(sessionId) {
  let shouldContinue = false;
  await updateSession(sessionId, (session) => {
    if (session) {
      session.currentRound += 1;
      session.status = 'waiting';
      session.question = null;
      session.answer = null;
      session.winner = null;
      if (session.currentRound <= session.maxRounds) {
      
        const currentIndex = session.players.findIndex(p => p.id === session.gameMaster.id);
        const nextIndex = (currentIndex + 1) % session.players.length;
        session.gameMaster = { ...session.players[nextIndex] };
        shouldContinue = true;
      } else {
        shouldContinue = false; 
      }
    }
  });
  return shouldContinue;
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  addPlayer,
  setQuestion,
  startGame,
  endGame,
  advanceToNextRound,
};