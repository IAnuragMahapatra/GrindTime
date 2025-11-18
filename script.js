const SECONDS_PER_LIFE = 1800;
const STUDY_TO_GAME_RATIO = 4;
const MAX_CONTINUOUS_GAME_SECONDS = 7200;

const state = {
  studyClockRunning: false,
  studyClockStartTime: null,
  totalStudySecondsToday: 0,

  gameClockRunning: false,
  gameClockStartTime: null,
  totalGameAwardedSecondsToday: 0,
  totalGameConsumedSecondsToday: 0,
  gameContinuousRunStartTime: null,

  lastSavedDate: null
};

function init() {
  loadState();
  checkMidnightReset();
  updateUI();
  startUpdateLoop();
  attachEventListeners();
  requestNotificationPermission();
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showNotification(title, body, icon = '⏰') {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'grindtime-notification',
      requireInteraction: false,
      silent: false
    });
  }
}

function loadState() {
  const saved = localStorage.getItem('clockState');
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
  }
}

function saveState() {
  localStorage.setItem('clockState', JSON.stringify(state));
}

function checkMidnightReset() {
  const today = getDateString();

  if (state.lastSavedDate && state.lastSavedDate !== today) {

    state.studyClockRunning = false;
    state.studyClockStartTime = null;
    state.totalStudySecondsToday = 0;

    state.gameClockRunning = false;
    state.gameClockStartTime = null;
    state.totalGameAwardedSecondsToday = 0;
    state.totalGameConsumedSecondsToday = 0;
    state.gameContinuousRunStartTime = null;
  }

  state.lastSavedDate = today;
  saveState();
}

function getDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getCurrentStudySeconds() {
  let total = state.totalStudySecondsToday;

  if (state.studyClockRunning && state.studyClockStartTime) {
    const elapsed = Math.floor((Date.now() - state.studyClockStartTime) / 1000);
    total += elapsed;
  }

  return total;
}

function getCurrentGameSeconds() {
  let consumed = state.totalGameConsumedSecondsToday;

  if (state.gameClockRunning && state.gameClockStartTime) {
    const elapsed = Math.floor((Date.now() - state.gameClockStartTime) / 1000);
    consumed += elapsed;
  }

  return consumed;
}

function getAvailableGameSeconds() {
  const studySeconds = getCurrentStudySeconds();
  const earnedFromStudy = Math.floor(studySeconds / STUDY_TO_GAME_RATIO);
  const totalEarned = earnedFromStudy + state.totalGameAwardedSecondsToday;

  const consumed = getCurrentGameSeconds();

  return Math.max(0, totalEarned - consumed);
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimeReadable(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

function updateUI() {
  const studySeconds = getCurrentStudySeconds();
  document.getElementById('studyTime').textContent = formatTime(studySeconds);
  document.getElementById('totalStudyTime').textContent = formatTimeReadable(studySeconds);

  const studyBtn = document.getElementById('studyStartPause');
  studyBtn.textContent = state.studyClockRunning ? 'Pause' : 'Start';

  studyBtn.disabled = state.gameClockRunning;

  const availableSeconds = getAvailableGameSeconds();

  document.getElementById('gameTime').textContent = formatTime(availableSeconds);

  const totalEarnedSeconds = availableSeconds + getCurrentGameSeconds();
  document.getElementById('totalGameTime').textContent = formatTimeReadable(totalEarnedSeconds);

  const gameBtn = document.getElementById('gameStartPause');
  gameBtn.textContent = state.gameClockRunning ? 'Pause' : 'Start';

  gameBtn.disabled = state.studyClockRunning;

  if (availableSeconds <= 0 && state.gameClockRunning) {
    stopGameClock();
    showNotification('Game Time Over! ⏰', 'Your game time has ended. Time to get back to studying!');
  }

  updateLivesDisplay(availableSeconds);

  checkContinuousGameLimit();
}

function updateLivesDisplay(availableSeconds) {
  const totalLives = availableSeconds / SECONDS_PER_LIFE;
  const fullLives = Math.floor(totalLives);
  const partialLife = totalLives - fullLives;

  const livesDisplay = document.getElementById('livesDisplay');
  livesDisplay.innerHTML = '';

  for (let i = 0; i < fullLives; i++) {
    const life = document.createElement('div');
    life.className = 'life';
    livesDisplay.appendChild(life);
  }

  if (partialLife > 0) {
    const life = document.createElement('div');
    life.className = 'life partial';
    life.style.setProperty('--fill-percent', `${partialLife * 100}%`);
    livesDisplay.appendChild(life);
  }

  const totalMinutes = Math.floor(availableSeconds / 60);
  const livesText = document.getElementById('livesText');
  livesText.textContent = `${totalLives.toFixed(1)} lives (${totalMinutes} min)`;
}

function checkContinuousGameLimit() {
  if (state.gameClockRunning && state.gameContinuousRunStartTime) {
    const continuousSeconds = Math.floor((Date.now() - state.gameContinuousRunStartTime) / 1000);

    if (continuousSeconds >= MAX_CONTINUOUS_GAME_SECONDS) {
      stopGameClock();
      showWarningModal();
      showNotification('2 Hour Limit Reached! 🎮', 'You have gamed for 2 hours straight. Time to take a break and study!');
    }
  }
}

function showWarningModal() {
  const modal = document.getElementById('warningModal');
  modal.classList.add('show');
}

function hideWarningModal() {
  const modal = document.getElementById('warningModal');
  modal.classList.remove('show');
}

function showResetModal() {
  const modal = document.getElementById('resetModal');
  modal.classList.add('show');
}

function hideResetModal() {
  const modal = document.getElementById('resetModal');
  modal.classList.remove('show');
}

function showNoGameTimeModal() {
  const modal = document.getElementById('noGameTimeModal');
  modal.classList.add('show');
}

function hideNoGameTimeModal() {
  const modal = document.getElementById('noGameTimeModal');
  modal.classList.remove('show');
}

function confirmReset() {

  state.studyClockRunning = false;
  state.studyClockStartTime = null;
  state.totalStudySecondsToday = 0;

  state.gameClockRunning = false;
  state.gameClockStartTime = null;
  state.totalGameAwardedSecondsToday = 0;
  state.totalGameConsumedSecondsToday = 0;
  state.gameContinuousRunStartTime = null;

  saveState();
  updateUI();
  hideResetModal();
}

function toggleStudyClock() {
  if (state.studyClockRunning) {
    const elapsed = Math.floor((Date.now() - state.studyClockStartTime) / 1000);
    state.totalStudySecondsToday += elapsed;
    state.studyClockRunning = false;
    state.studyClockStartTime = null;
  } else {

    if (state.gameClockRunning) {
      stopGameClock();
    }
    state.studyClockRunning = true;
    state.studyClockStartTime = Date.now();
  }

  saveState();
  updateUI();
}

function toggleGameClock() {
  if (state.gameClockRunning) {
    stopGameClock();
  } else {
    const available = getAvailableGameSeconds();
    if (available <= 0) {
      showNoGameTimeModal();
      return;
    }

    if (state.studyClockRunning) {
      const elapsed = Math.floor((Date.now() - state.studyClockStartTime) / 1000);
      state.totalStudySecondsToday += elapsed;
      state.studyClockRunning = false;
      state.studyClockStartTime = null;
    }

    state.gameClockRunning = true;
    state.gameClockStartTime = Date.now();
    state.gameContinuousRunStartTime = Date.now();
  }

  saveState();
  updateUI();
}

function stopGameClock() {
  if (state.gameClockRunning && state.gameClockStartTime) {
    const elapsed = Math.floor((Date.now() - state.gameClockStartTime) / 1000);
    state.totalGameConsumedSecondsToday += elapsed;
    state.gameClockRunning = false;
    state.gameClockStartTime = null;
    state.gameContinuousRunStartTime = null;
  }

  saveState();
  updateUI();
}

function addTaskBonus() {
  state.totalGameAwardedSecondsToday += SECONDS_PER_LIFE;
  saveState();
  updateUI();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('open');
}

function attachEventListeners() {
  document.getElementById('studyStartPause').addEventListener('click', toggleStudyClock);
  document.getElementById('gameStartPause').addEventListener('click', toggleGameClock);
  document.getElementById('taskCompleted').addEventListener('click', addTaskBonus);
  document.getElementById('modalClose').addEventListener('click', hideWarningModal);
  document.getElementById('menuBtn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebarClose').addEventListener('click', toggleSidebar);
  document.getElementById('resetBtn').addEventListener('click', showResetModal);
  document.getElementById('resetCancel').addEventListener('click', hideResetModal);
  document.getElementById('resetConfirm').addEventListener('click', confirmReset);
  document.getElementById('noGameTimeClose').addEventListener('click', hideNoGameTimeModal);
}

function startUpdateLoop() {
  setInterval(() => {
    checkMidnightReset();
    updateUI();
  }, 1000);
}

document.addEventListener('DOMContentLoaded', init);
