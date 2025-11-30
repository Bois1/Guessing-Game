const socket = io();
let currentSessionId = null;
let isGameMaster = false;


const playerNameInput = document.getElementById('playerName');
const sessionIdInput = document.getElementById('sessionIdInput');
const gameView = document.getElementById('gameView');
const displaySessionId = document.getElementById('displaySessionId');
const gameStatus = document.getElementById('gameStatus');
const playersList = document.getElementById('playersList');
const questionArea = document.getElementById('questionArea');
const questionText = document.getElementById('questionText');
const guessArea = document.getElementById('guessArea');
const guessInput = document.getElementById('guessInput');
const typingIndicator = document.getElementById('typingIndicator');
const masterControls = document.getElementById('masterControls');
const resultsArea = document.getElementById('resultsArea');
const resultsText = document.getElementById('resultsText');
const messages = document.getElementById('messages');


function showMessage(msg, isError = false) {
  messages.textContent = msg;
  messages.className = isError ? 'mt-4 text-red-600 font-medium' : 'mt-4 text-green-600 font-medium';
  setTimeout(() => messages.textContent = '', 5000);
}


socket.on('error', (data) => showMessage(data.message, true));
socket.on('gameCreated', (data) => {
  currentSessionId = data.sessionId;
  displaySessionId.textContent = data.sessionId;
  gameView.classList.remove('hidden');
  document.getElementById('createJoin').classList.add('hidden');
});
socket.on('joinedGame', (data) => {
  currentSessionId = data.sessionId;
  displaySessionId.textContent = data.sessionId;
  gameView.classList.remove('hidden');
  document.getElementById('createJoin').classList.add('hidden');
});

socket.on('updatePlayers', (data) => {
  playersList.innerHTML = '';
  data.players.forEach(p => {
    const el = document.createElement('div');
    el.className = 'bg-gray-200 px-3 py-1 rounded flex items-center';
    el.textContent = p.name + (p.score ? ` (${p.score} pts)` : '');
    if (p.id === socket.id) el.classList.add('border-2', 'border-blue-500');
    playersList.appendChild(el);
  });
});

socket.on('newGameMaster', (data) => {
  isGameMaster = (data.gameMaster.id === socket.id);
  renderUI();
});

socket.on('questionReady', () => {
  showMessage('Question submitted! Waiting for game to start...');
});

socket.on('gameStarted', (data) => {
  gameStatus.textContent = 'Guessing!';
  questionText.textContent = data.question;
  questionArea.classList.remove('hidden');
  guessArea.classList.remove('hidden');
  masterControls.classList.add('hidden');
  resultsArea.classList.add('hidden');
  guessInput.focus();
});

socket.on('gameEnded', (data) => {
  guessArea.classList.add('hidden');
  questionArea.classList.add('hidden');
  resultsArea.classList.remove('hidden');
  if (data.reason === 'correct') {
    if (data.winner.id === socket.id) {
      resultsText.innerHTML = `<span class="text-green-600">You won! The answer was: ${data.answer}</span>`;
    } else {
      resultsText.innerHTML = `<span class="text-red-500">${data.winner.name} won! <br>Answer: ${data.answer}</span>`;
    }
  } else {
    resultsText.innerHTML = `<span class="text-gray-700">Time's up! No winner.<br>Answer: ${data.answer}</span>`;
  }
});

socket.on('nextRound', (data) => {
  document.getElementById('roundCounter').textContent = data.round;
  gameStatus.textContent = 'Waiting for new question...';
  masterControls.classList.remove('hidden');
  questionArea.classList.add('hidden');
  guessArea.classList.add('hidden');
  resultsArea.classList.add('hidden');
  isGameMaster = (data.gameMaster.id === socket.id);
  renderUI();
});

socket.on('gameOver', (data) => {
  resultsArea.classList.remove('hidden');
  const maxScore = Math.max(...data.players.map(p => p.score));
  const winners = data.players.filter(p => p.score === maxScore).map(p => p.name).join(', ');
  resultsText.innerHTML = `<span class="text-2xl font-bold"> Game Over! </span><br>Winner(s): ${winners}`;
  document.getElementById('nextRoundBtn').classList.add('hidden');
});

socket.on('userTyping', (data) => {
  if (data.playerId !== socket.id) {
    typingIndicator.textContent = 'Someone is typing...';
    typingIndicator.classList.add('blink');
  }
});

socket.on('userStoppedTyping', (data) => {
  typingIndicator.textContent = '';
  typingIndicator.classList.remove('blink');
});


function renderUI() {
  if (isGameMaster) {
    masterControls.classList.remove('hidden');
  } else {
    masterControls.classList.add('hidden');
  }
}


let typingTimer;
guessInput.addEventListener('input', () => {
  socket.emit('typingStart', { sessionId: currentSessionId });
});


function createGame() {
  const name = playerNameInput.value.trim();
  if (!name) return showMessage('Enter your name!', true);
  socket.emit('createGame', { playerName: name });
}

function joinGame() {
  const name = playerNameInput.value.trim();
  const sessionId = sessionIdInput.value.trim().toUpperCase();
  if (!name || !sessionId) return showMessage('Enter name and session ID!', true);
  socket.emit('joinGame', { sessionId, playerName: name });
}

function submitQuestion() {
  const q = document.getElementById('questionInput').value.trim();
  const a = document.getElementById('answerInput').value.trim();
  if (!q || !a) return showMessage('Both fields required!', true);
  socket.emit('submitQuestion', { sessionId: currentSessionId, question: q, answer: a });
  document.getElementById('questionInput').value = '';
  document.getElementById('answerInput').value = '';
}

function startGame() {
  socket.emit('startGame', { sessionId: currentSessionId });
}

function submitGuess() {
  const guess = guessInput.value.trim();
  if (!guess) return;
  socket.emit('submitGuess', { sessionId: currentSessionId, guess });
  guessInput.value = '';
  guessInput.disabled = true;
  setTimeout(() => guessInput.disabled = false, 1000);
}

function nextRound() {

}