const sessions = new Map(); 

function createSession(sessionId, gameMasterId, gameMasterName) {
  sessions.set(sessionId, {
    id: sessionId,
    status: 'waiting', 
    gameMaster: { id: gameMasterId, name: gameMasterName },
    players: [{ id: gameMasterId, name: gameMasterName, score: 0 }],
    question: null,
    answer: null,
    winner: null,
    startTime: null,
    timer: null,
  });
}

function getSession(sessionId) {
  return sessions.get(sessionId);
}

function deleteSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session?.timer) clearTimeout(session.timer);
  sessions.delete(sessionId);
}

function addPlayer(sessionId, playerId, playerName) {
  const session = getSession(sessionId);
  if (!session || session.status !== 'waiting') return false;
  const exists = session.players.some(p => p.id === playerId);
  if (!exists) {
    session.players.push({ id: playerId, name: playerName, score: 0 });
  }
  return true;
}

function setQuestion(sessionId, question, answer) {
  const session = getSession(sessionId);
  if (!session) return false;
  session.question = question;
  session.answer = answer.toLowerCase().trim();
  return true;
}

function startGame(sessionId) {
  const session = getSession(sessionId);
  if (!session || session.status !== 'waiting' || session.players.length < 3) return false;
  session.status = 'active';
  session.startTime = Date.now();
 
  session.timer = setTimeout(() => endGame(sessionId, 'timeout'), 60000);
  return true;
}

function endGame(sessionId, reason, winnerId = null) {
  const session = getSession(sessionId);
  if (!session || session.status !== 'active') return;
  session.status = 'ended';
  if (session.timer) clearTimeout(session.timer);
  if (reason === 'correct' && winnerId) {
    const winner = session.players.find(p => p.id === winnerId);
    if (winner) {
      winner.score += 10;
      session.winner = winnerId;
    }
  }
}

function cleanupEmptySessions() {
  for (const [id, session] of sessions.entries()) {
    if (session.players.length === 0) {
      deleteSession(id);
    }
  }
}

module.exports = {
  createSession,
  getSession,
  deleteSession,
  addPlayer,
  setQuestion,
  startGame,
  endGame,
  cleanupEmptySessions,
};