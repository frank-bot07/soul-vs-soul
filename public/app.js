/**
 * Soul vs Soul - State of the Art Web Spectator
 * Real-time WebSocket client with smooth animations
 */

class BeastGamesSpectator {
  constructor() {
    this.socket = null;
    this.gameState = {
      status: 'waiting',
      round: 0,
      activeAgents: [],
      eliminatedAgents: [],
      currentChallenge: null,
      winner: null,
      gameLog: [],
      connectedSpectators: 0
    };
    
    this.elements = {};
    this.animationQueue = [];
    this.isAnimating = false;
    this.uploadedAgents = [];
    this.selectedPersonalities = new Set();
    this.personalities = [];
    this.isArenaMode = false;
    this.leaderboardData = [];
    this.sidebarOpen = false;
    
    this.init();
  }

  async init() {
    try {
      this.initializeElements();
      console.log('✅ Elements initialized');
    } catch(e) { console.error('❌ initializeElements:', e); }
    
    try {
      this.setupEventListeners();
      console.log('✅ Event listeners set up');
    } catch(e) { console.error('❌ setupEventListeners:', e); }
    
    try {
      this.createParticleSystem();
      console.log('✅ Particle system created');
    } catch(e) { console.error('❌ createParticleSystem:', e); }
    
    try {
      this.connectWebSocket();
      console.log('✅ WebSocket connecting');
    } catch(e) { console.error('❌ connectWebSocket:', e); }
    
    try {
      this.updateTimestamps();
    } catch(e) { console.error('❌ updateTimestamps:', e); }
    
    try {
      this.detectArenaMode();
      console.log('✅ Arena mode detected');
    } catch(e) { console.error('❌ detectArenaMode:', e); }
    
    try {
      this.animationLoop();
    } catch(e) { console.error('❌ animationLoop:', e); }
  }

  detectArenaMode() {
    // Check if we have lobby elements - indicates arena mode
    this.isArenaMode = !!this.elements.arenaLobby;
    
    if (this.isArenaMode) {
      console.log('🏟️ Arena mode detected');
      this.showLobby();
      this.loadPersonalities();
      this.loadUploadedAgents();
    } else {
      console.log('👁️ Spectator mode detected');
      this.showArena();
    }
    
    // Initialize leaderboard
    this.updateLeaderboard();
    
    // Handle responsive sidebar behavior
    this.handleResponsiveSidebar();
  }

  showLobby() {
    if (this.elements.arenaLobby) {
      this.elements.arenaLobby.classList.add('visible');
      this.elements.arenaLobby.style.display = 'block';
    }
    if (this.elements.arenaLayout) {
      this.elements.arenaLayout.classList.remove('visible');
      this.elements.arenaLayout.style.display = 'none';
    }
  }

  showArena() {
    if (this.elements.arenaLobby) {
      this.elements.arenaLobby.classList.remove('visible');
      this.elements.arenaLobby.style.display = 'none';
    }
    if (this.elements.arenaLayout) {
      this.elements.arenaLayout.classList.add('visible');
      this.elements.arenaLayout.style.display = 'grid';
    }
  }

  initializeElements() {
    this.elements = {
      connectionStatus: document.getElementById('connectionStatus'),
      statusBar: document.getElementById('statusBar'),
      roundIndicator: document.getElementById('roundIndicator'),
      agentsRemaining: document.getElementById('agentsRemaining'),
      challengeInfo: document.getElementById('challengeInfo'),
      startGameBtn: document.getElementById('startGameBtn'),
      resetBtn: document.getElementById('resetBtn'),
      spectatorCount: document.getElementById('spectatorCount'),
      agentsGrid: document.getElementById('agentsGrid'),
      eliminatedSection: document.getElementById('eliminatedSection'),
      eliminatedGrid: document.getElementById('eliminatedGrid'),
      trashTalkSection: document.getElementById('trashTalkSection'),
      trashTalkFeed: document.getElementById('trashTalkFeed'),
      scoreboard: document.getElementById('scoreboard'),
      scoreList: document.getElementById('scoreList'),
      liveFeed: document.getElementById('liveFeed'),
      feedContent: document.getElementById('feedContent'),
      clearFeed: document.getElementById('clearFeed'),
      winnerModal: document.getElementById('winnerModal'),
      winnerInfo: document.getElementById('winnerInfo'),
      finalStats: document.getElementById('finalStats'),
      playAgainBtn: document.getElementById('playAgainBtn'),
      confettiCanvas: document.getElementById('confettiCanvas'),
      // Lobby elements
      arenaLobby: document.getElementById('arenaLobby'),
      arenaLayout: document.getElementById('arenaLayout'),
      agentUploadForm: document.getElementById('agentUploadForm'),
      registeredGrid: document.getElementById('registeredGrid'),
      emptyState: document.getElementById('emptyState'),
      agentRequirement: document.getElementById('agentRequirement'),
      requirementFill: document.getElementById('requirementFill'),
      agentCount: document.getElementById('agentCount'),
      startArenaBtn: document.getElementById('startArenaBtn'),
      fillBotsBtn: document.getElementById('fillBotsBtn'),
      templateButtons: document.getElementById('templateButtons'),
      // Personality elements
      personalityGrid: document.getElementById('personalityGrid'),
      // Upload elements
      uploadCard: document.getElementById('uploadCard'),
      // Leaderboard elements
      leaderboardSidebar: document.getElementById('leaderboardSidebar'),
      leaderboardList: document.getElementById('leaderboardList'),
      leaderboardActions: document.getElementById('leaderboardActions'),
      sidebarToggle: document.getElementById('sidebarToggle'),
      sidebarToggleMobile: document.getElementById('sidebarToggleMobile'),
      shareResultsBtn: document.getElementById('shareResultsBtn')
    };
  }

  setupEventListeners() {
    if (this.elements.startGameBtn) {
      this.elements.startGameBtn.addEventListener('click', () => this.startGame());
    }
    if (this.elements.playAgainBtn) {
      this.elements.playAgainBtn.addEventListener('click', () => this.resetGame());
    }
    if (this.elements.clearFeed) {
      this.elements.clearFeed.addEventListener('click', () => this.clearFeed());
    }
    
    // Close modal on outside click
    if (this.elements.winnerModal) {
      this.elements.winnerModal.addEventListener('click', (e) => {
        if (e.target === this.elements.winnerModal) {
          this.hideWinnerModal();
        }
      });
    }

    // Lobby event listeners
    if (this.elements.agentUploadForm) {
      this.elements.agentUploadForm.addEventListener('submit', (e) => this.handleAgentUpload(e));
      this.elements.startArenaBtn.addEventListener('click', () => this.startArenaGame());
      this.elements.fillBotsBtn.addEventListener('click', () => this.fillWithBots());
      
      // File drag and drop
      this.setupFileDropZones();
      
      // Template downloads
      this.elements.templateButtons?.addEventListener('click', (e) => {
        if (e.target.classList.contains('template-btn')) {
          this.downloadTemplate(e.target.dataset.template);
        }
      });
      
      // Download example links
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('download-example')) {
          e.preventDefault();
          this.downloadExample(e.target.dataset.file);
        }
      });
    }

    // Leaderboard sidebar event listeners
    if (this.elements.sidebarToggle) {
      this.elements.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }
    if (this.elements.sidebarToggleMobile) {
      this.elements.sidebarToggleMobile.addEventListener('click', () => this.toggleSidebar());
    }
    if (this.elements.shareResultsBtn) {
      this.elements.shareResultsBtn.addEventListener('click', () => this.shareResults());
    }
  }

  connectWebSocket() {
    console.log('🔌 Connecting to Soul vs Soul server...');
    
    this.socket = io();
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to Soul vs Soul server');
      this.updateConnectionStatus(true);
      this.addFeedItem('🟢', 'Connected to Soul vs Soul server', 'system');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      this.updateConnectionStatus(false);
      this.addFeedItem('🔴', 'Disconnected from server', 'system');
    });

    // Game event handlers
    this.socket.on('game_state', (data) => this.updateGameState(data));
    this.socket.on('game_started', (data) => this.handleGameStarted(data));
    this.socket.on('agents_initialized', (data) => this.handleAgentsInitialized(data));
    this.socket.on('round_start', (data) => this.handleRoundStart(data));
    this.socket.on('challenge_announce', (data) => this.handleChallengeAnnounce(data));
    this.socket.on('agent_thinking', (data) => this.handleAgentThinking(data));
    
    // Arena mode handlers
    this.socket.on('agent_uploaded', (data) => this.handleAgentUploaded(data));
    this.socket.on('agent_deleted', (data) => this.handleAgentDeleted(data));
    this.socket.on('results', (data) => this.handleResults(data));
    this.socket.on('elimination', (data) => this.handleElimination(data));
    this.socket.on('trash_talk', (data) => this.handleTrashTalk(data));
    this.socket.on('winner', (data) => this.handleWinner(data));
    this.socket.on('game_error', (data) => this.handleGameError(data));
  }

  updateConnectionStatus(connected) {
    if (!this.elements.connectionStatus) return;
    const indicator = this.elements.connectionStatus.querySelector('.status-indicator');
    const text = this.elements.connectionStatus.querySelector('span');
    if (!indicator || !text) return;
    
    if (connected) {
      indicator.classList.remove('offline');
      indicator.classList.add('online');
      text.textContent = 'Connected';
    } else {
      indicator.classList.remove('online');
      indicator.classList.add('offline');
      text.textContent = 'Disconnected';
    }
  }

  async startGame() {
    this.elements.startGameBtn.disabled = true;
    this.elements.startGameBtn.textContent = 'Starting...';
    
    try {
      const response = await fetch('/api/start', { method: 'POST' });
      const result = await response.json();
      
      if (response.ok) {
        this.addFeedItem('🚀', result.message, 'system');
      } else {
        throw new Error(result.error || 'Failed to start game');
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      this.addFeedItem('❌', `Failed to start game: ${error.message}`, 'system');
      this.elements.startGameBtn.disabled = false;
      this.elements.startGameBtn.textContent = 'START GAME';
    }
  }

  resetGame() {
    location.reload(); // Simple reset for now
  }

  // Event Handlers
  updateGameState(data) {
    this.gameState = { ...this.gameState, ...data };
    if (this.elements.spectatorCount) {
      this.elements.spectatorCount.textContent = `👥 ${data.connectedSpectators || 0} spectators`;
    }
    this.updateLeaderboard();
  }

  handleGameStarted(data) {
    this.addFeedItem('🎮', 'Soul vs Soul competition has begun!', 'system');
    this.elements.startGameBtn.style.display = 'none';
    this.elements.resetBtn.style.display = 'inline-block';
    
    // Update status
    this.updateRoundIndicator('STARTING', '');
  }

  handleAgentsInitialized(data) {
    this.gameState.activeAgents = data.agents;
    this.renderAgents();
    this.addFeedItem('🤖', `${data.agents.length} AI agents have entered the arena!`, 'system');
    this.updateLeaderboard();
  }

  handleRoundStart(data) {
    this.gameState.round = data.round;
    this.gameState.activeAgents = data.activeAgents;
    
    this.updateRoundIndicator(data.roundName.toUpperCase(), data.round);
    this.updateAgentsRemaining(data.activeAgents.length);
    
    this.addFeedItem('🏁', `${data.roundName} begins! ${data.eliminateCount} agents will be eliminated.`, 'round');
    
    // Animate agents for new round
    this.animateAgentsForNewRound();
    this.updateLeaderboard();
  }

  handleChallengeAnnounce(data) {
    this.gameState.currentChallenge = data.challenge;
    this.updateChallengeDisplay(data.challenge);
    
    this.addFeedItem(data.challenge.icon, `Challenge: ${data.challenge.name}`, 'challenge');
    this.addFeedItem('📋', data.challenge.description, 'challenge');
    
    // Dramatic challenge reveal animation
    this.animateChallengeReveal();
  }

  handleAgentThinking(data) {
    this.setAgentStatus(data.agent.id, 'thinking');
    
    // Update agent status in game state for leaderboard
    if (this.gameState.activeAgents) {
      const agent = this.gameState.activeAgents.find(a => a.id === data.agent.id);
      if (agent) {
        agent.status = 'thinking';
      }
    }
    
    this.addFeedItem('🤔', `${data.agent.emoji} ${data.agent.name} is thinking...`, 'thinking');
    this.updateLeaderboard();
  }

  handleResults(data) {
    this.gameState.lastResults = data.results;
    
    // Update agent scores in game state
    if (this.gameState.activeAgents) {
      this.gameState.activeAgents.forEach(agent => {
        const result = data.results.find(r => r.agent.id === agent.id);
        if (result) {
          agent.score = result.score;
        }
      });
    }
    
    // Show results with animated scores
    this.animateResults(data.results);
    
    this.addFeedItem('📊', 'Challenge results are in!', 'results');
    
    // Update scoreboard
    this.updateScoreboard(data.results);
    this.updateLeaderboard();
  }

  handleElimination(data) {
    // Update game state
    this.gameState.activeAgents = this.gameState.activeAgents.filter(a => a.id !== data.agent.id);
    this.gameState.eliminatedAgents = this.gameState.eliminatedAgents || [];
    this.gameState.eliminatedAgents.push({
      ...data.agent,
      isAlive: false,
      status: 'eliminated',
      finalScore: data.finalScore || 0
    });
    
    // Move agent to eliminated section
    this.eliminateAgent(data.agent);
    
    this.addFeedItem('💀', `${data.agent.emoji} ${data.agent.name} has been eliminated!`, 'elimination');
    
    // Dramatic elimination animation
    this.animateElimination(data.agent);
    
    // Update remaining count
    this.updateAgentsRemaining(this.gameState.activeAgents.length);
    this.updateLeaderboard();
  }

  handleTrashTalk(data) {
    this.addTrashTalkToFeed(data);
    this.addTrashTalk(data);
    this.addFeedItem('🗣️', `${data.agent}: "${data.message}"`, 'trash-talk');
  }

  handleWinner(data) {
    this.gameState.winner = data.winner;
    this.gameState.stats = data.stats;
    this.gameState.status = 'finished';
    
    this.addFeedItem('🏆', `${data.winner.emoji} ${data.winner.name} wins Soul vs Soul!`, 'winner');
    
    // Show winner modal with confetti
    this.showWinnerModal(data.winner, data.stats);
    
    // Show share results button and update leaderboard
    this.showShareButton();
    this.updateLeaderboard();
  }

  handleGameError(data) {
    this.addFeedItem('❌', `Game Error: ${data.error}`, 'system');
  }

  // UI Update Methods
  updateRoundIndicator(label, number) {
    const labelEl = this.elements.roundIndicator.querySelector('.round-label');
    const numberEl = this.elements.roundIndicator.querySelector('.round-number');
    
    labelEl.textContent = label;
    numberEl.textContent = number;
    
    // Animate update
    this.elements.roundIndicator.style.animation = 'none';
    setTimeout(() => {
      this.elements.roundIndicator.style.animation = 'bounce 0.6s ease';
    }, 10);
  }

  updateAgentsRemaining(count) {
    const countEl = this.elements.agentsRemaining.querySelector('.count');
    countEl.textContent = count;
    
    // Animate count change
    countEl.style.animation = 'none';
    setTimeout(() => {
      countEl.style.animation = 'pulse 0.5s ease';
    }, 10);
  }

  updateChallengeDisplay(challenge) {
    const icon = this.elements.challengeInfo.querySelector('.challenge-icon');
    const name = this.elements.challengeInfo.querySelector('.challenge-name');
    const desc = this.elements.challengeInfo.querySelector('.challenge-desc');
    
    icon.textContent = challenge.icon;
    name.textContent = challenge.name;
    desc.textContent = challenge.description;
  }

  renderAgents() {
    const grid = this.elements.agentsGrid;
    grid.innerHTML = '';
    
    this.gameState.activeAgents.forEach((agent, index) => {
      const card = this.createAgentCard(agent);
      card.style.animationDelay = `${index * 0.1}s`;
      grid.appendChild(card);
    });
  }

  createAgentCard(agent) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.setAttribute('data-agent-id', agent.id);
    
    card.innerHTML = `
      <div class="agent-avatar">${agent.emoji}</div>
      <div class="agent-name">${agent.name}</div>
      <div class="agent-personality">${agent.personality}</div>
      <div class="agent-status">
        <div class="status-indicator-card status-alive" data-status="alive">ALIVE</div>
        <div class="agent-score">0</div>
      </div>
      <div class="score-history" data-history=""></div>
    `;
    
    return card;
  }

  setAgentStatus(agentId, status) {
    const card = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (!card) return;
    
    const statusEl = card.querySelector('.status-indicator-card');
    statusEl.className = `status-indicator-card status-${status}`;
    statusEl.textContent = status.toUpperCase();
  }

  eliminateAgent(agent) {
    const card = document.querySelector(`[data-agent-id="${agent.id}"]`);
    if (!card) return;
    
    // Animate elimination
    card.style.transition = 'all 1s ease';
    card.style.transform = 'scale(0.8) rotate(-5deg)';
    card.style.opacity = '0.3';
    card.style.filter = 'grayscale(100%)';
    
    setTimeout(() => {
      // Move to eliminated section
      card.remove();
      this.addEliminatedAgent(agent);
    }, 1000);
  }

  addEliminatedAgent(agent) {
    if (!this.elements.eliminatedGrid) return;
    
    this.elements.eliminatedSection.style.display = 'block';
    
    const eliminatedCard = document.createElement('div');
    eliminatedCard.className = 'eliminated-card';
    eliminatedCard.innerHTML = `
      <div class="agent-avatar">${agent.emoji}</div>
      <div class="agent-name">${agent.name}</div>
    `;
    
    this.elements.eliminatedGrid.appendChild(eliminatedCard);
  }

  updateScoreboard(results) {
    this.elements.scoreList.innerHTML = '';
    
    // Sort by score (highest first)
    const sortedResults = [...results].sort((a, b) => b.score - a.score);
    const maxScore = Math.max(...results.map(r => r.score));
    
    sortedResults.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'score-item';
      item.style.animationDelay = `${index * 0.1}s`;
      
      const rank = this.getRankEmoji(index + 1);
      const progressWidth = maxScore > 0 ? (result.score / maxScore) * 100 : 0;
      
      item.innerHTML = `
        <div class="score-rank">${rank}</div>
        <div class="score-agent">
          <span class="agent-avatar">${result.agent.emoji}</span>
          <span class="agent-name">${result.agent.name}</span>
        </div>
        <div class="score-value">${result.score}</div>
        <div class="score-bar-container">
          <div class="score-progress" style="width: ${progressWidth}%"></div>
        </div>
      `;
      
      this.elements.scoreList.appendChild(item);
    });
  }

  getRankEmoji(rank) {
    const emojis = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
    return emojis[rank - 1] || `${rank}`;
  }

  addFeedItem(icon, message, type = 'system') {
    const item = document.createElement('div');
    item.className = `feed-item ${type}`;
    
    item.innerHTML = `
      <div class="feed-icon">${icon}</div>
      <div class="feed-text">
        <span class="feed-message">${message}</span>
        <span class="feed-time" data-time="${Date.now()}"></span>
      </div>
    `;
    
    this.elements.feedContent.appendChild(item);
    
    // Auto-scroll to bottom
    this.elements.feedContent.scrollTop = this.elements.feedContent.scrollHeight;
    
    // Limit feed items
    const items = this.elements.feedContent.children;
    if (items.length > 50) {
      items[0].remove();
    }
  }

  addTrashTalk(data) {
    // Find the agent card and add speech bubble
    const card = document.querySelector(`[data-agent-id="${data.agent}"]`);
    if (!card) return;
    
    // Remove existing bubble first
    const existing = card.querySelector('.speech-bubble');
    if (existing) existing.remove();
    
    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble';
    bubble.textContent = data.message;
    
    card.appendChild(bubble);
    
    // Remove bubble after delay
    setTimeout(() => {
      if (bubble.parentNode) {
        bubble.remove();
      }
    }, 6000);
  }

  addTrashTalkToFeed(data) {
    if (!this.elements.trashTalkSection || !this.elements.trashTalkFeed) return;
    
    // Show the section on first trash talk
    this.elements.trashTalkSection.style.display = 'block';
    
    // Find agent info for emoji/color
    const agentInfo = this.getAgentDisplayInfo(data.agent);
    
    const msg = document.createElement('div');
    msg.className = 'trash-talk-msg';
    msg.style.setProperty('--agent-color', agentInfo.color);
    msg.innerHTML = `
      <div class="trash-talk-avatar">${agentInfo.emoji}</div>
      <div class="trash-talk-body">
        <div class="trash-talk-name" style="color: ${agentInfo.color}">${data.agent}</div>
        <div class="trash-talk-text">${data.message}</div>
      </div>
    `;
    
    this.elements.trashTalkFeed.appendChild(msg);
    
    // Auto-scroll to latest
    this.elements.trashTalkFeed.scrollTop = this.elements.trashTalkFeed.scrollHeight;
    
    // Keep max 30 messages
    while (this.elements.trashTalkFeed.children.length > 30) {
      this.elements.trashTalkFeed.removeChild(this.elements.trashTalkFeed.firstChild);
    }
  }

  getAgentDisplayInfo(agentName) {
    // Try to find from game state agents
    const agents = [...(this.gameState.activeAgents || []), ...(this.gameState.eliminatedAgents || [])];
    const agent = agents.find(a => a.name === agentName);
    if (agent) {
      return { emoji: agent.emoji || '🤖', color: agent.color || '#FF6B35' };
    }
    // Fallback
    return { emoji: '🤖', color: '#FF6B35' };
  }

  clearFeed() {
    this.elements.feedContent.innerHTML = '';
    this.addFeedItem('🧹', 'Feed cleared', 'system');
  }

  // Animation Methods
  animateAgentsForNewRound() {
    const cards = document.querySelectorAll('.agent-card');
    cards.forEach((card, index) => {
      card.style.animation = 'none';
      setTimeout(() => {
        card.style.animation = `slideInUp 0.6s ease ${index * 0.1}s`;
      }, 10);
    });
  }

  animateChallengeReveal() {
    const challengeInfo = this.elements.challengeInfo;
    challengeInfo.style.animation = 'none';
    setTimeout(() => {
      challengeInfo.style.animation = 'bounce 1s ease';
    }, 10);
  }

  animateResults(results) {
    // Update agent scores with animation
    results.forEach((result, index) => {
      setTimeout(() => {
        const card = document.querySelector(`[data-agent-id="${result.agent.id}"]`);
        if (card) {
          const scoreEl = card.querySelector('.agent-score');
          this.animateNumber(scoreEl, 0, result.score, 1000);
          this.setAgentStatus(result.agent.id, 'alive');
        }
      }, index * 200);
    });
  }

  animateNumber(element, from, to, duration) {
    const startTime = performance.now();
    const diff = to - from;
    
    const updateNumber = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(from + diff * progress);
      
      element.textContent = current;
      
      if (progress < 1) {
        requestAnimationFrame(updateNumber);
      }
    };
    
    requestAnimationFrame(updateNumber);
  }

  animateElimination(agent) {
    // Add dramatic elimination effect
    const card = document.querySelector(`[data-agent-id="${agent.id}"]`);
    if (card) {
      card.style.animation = 'shatter 1s ease';
    }
  }

  showWinnerModal(winner, stats) {
    this.elements.winnerModal.classList.add('show');
    
    // Update winner info
    const avatar = this.elements.winnerInfo.querySelector('.winner-avatar');
    const name = this.elements.winnerInfo.querySelector('.winner-name');
    
    avatar.textContent = winner.emoji;
    name.textContent = winner.name;
    
    // Start confetti
    this.startConfetti();
    
    // Populate final stats
    this.populateFinalStats(stats);
  }

  hideWinnerModal() {
    this.elements.winnerModal.classList.remove('show');
    this.stopConfetti();
  }

  populateFinalStats(stats) {
    if (!stats) return;
    
    this.elements.finalStats.innerHTML = `
      <h3>🏆 Final Results</h3>
      <p><strong>Duration:</strong> ${stats.duration}</p>
      <p><strong>Rounds Completed:</strong> ${stats.totalRounds}</p>
      <p><strong>Challenges:</strong> ${stats.challengesCompleted}</p>
    `;
  }

  // Particle System
  createParticleSystem() {
    const container = document.getElementById('particles');
    
    // Create floating particles
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = '2px';
      particle.style.height = '2px';
      particle.style.background = '#00ffff';
      particle.style.borderRadius = '50%';
      particle.style.opacity = Math.random() * 0.5;
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animation = `float ${5 + Math.random() * 10}s ease-in-out infinite`;
      particle.style.animationDelay = Math.random() * 5 + 's';
      
      container.appendChild(particle);
    }
    
    // Add floating animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes float {
        0%, 100% { transform: translate(0, 0) rotate(0deg); }
        25% { transform: translate(20px, -20px) rotate(90deg); }
        50% { transform: translate(-20px, 20px) rotate(180deg); }
        75% { transform: translate(-20px, -20px) rotate(270deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // Confetti System
  startConfetti() {
    const canvas = this.elements.confettiCanvas;
    const ctx = canvas.getContext('2d');
    
    canvas.width = this.elements.winnerModal.offsetWidth;
    canvas.height = this.elements.winnerModal.offsetHeight;
    
    const confetti = [];
    const colors = ['#ff006e', '#00ffff', '#8338ec', '#ffbe0b', '#00ff88'];
    
    // Create confetti pieces
    for (let i = 0; i < 150; i++) {
      confetti.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10
      });
    }
    
    this.confettiActive = true;
    
    const animate = () => {
      if (!this.confettiActive) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        
        c.y += c.vy;
        c.x += c.vx;
        c.rotation += c.rotationSpeed;
        
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation * Math.PI / 180);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size/2, -c.size/2, c.size, c.size);
        ctx.restore();
        
        // Remove confetti that fell off screen
        if (c.y > canvas.height + 10) {
          confetti.splice(i, 1);
        }
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  stopConfetti() {
    this.confettiActive = false;
  }

  // Animation Loop
  animationLoop() {
    // Update timestamps
    this.updateTimestamps();
    
    requestAnimationFrame(() => this.animationLoop());
  }

  updateTimestamps() {
    const timeElements = document.querySelectorAll('[data-time]');
    timeElements.forEach(el => {
      const timestamp = parseInt(el.getAttribute('data-time'));
      if (timestamp && timestamp > 0) {
        el.textContent = this.formatTime(timestamp);
      }
    });
  }

  // === ARENA LOBBY METHODS ===

  async loadUploadedAgents() {
    if (!this.isArenaMode) return;
    
    try {
      const response = await fetch('/api/agents');
      const agents = await response.json();
      this.uploadedAgents = agents;
      this.updateRegisteredAgents();
    } catch (error) {
      console.error('Failed to load uploaded agents:', error);
    }
  }

  setupFileDropZones() {
    const dropZones = document.querySelectorAll('.file-drop-zone');
    
    dropZones.forEach(zone => {
      const targetId = zone.dataset.target;
      const input = document.getElementById(targetId);
      
      zone.addEventListener('click', () => input.click());
      
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
      });
      
      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
      });
      
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          input.files = files;
          this.updateFileDropZone(zone, files[0]);
        }
      });
      
      input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.updateFileDropZone(zone, e.target.files[0]);
        }
      });
    });
  }

  updateFileDropZone(zone, file) {
    zone.classList.add('has-file');
    const content = zone.querySelector('.drop-zone-content');
    const icon = zone.querySelector('.drop-icon');
    const text = zone.querySelector('p');
    
    icon.textContent = '✅';
    text.textContent = `${file.name} selected`;
  }

  async handleAgentUpload(e) {
    e.preventDefault();
    
    const form = e.target;
    const nameInput = form.querySelector('#agentName');
    const soulInput = form.querySelector('#soulFile');
    
    // Manual validation (file input is hidden so browser can't validate)
    if (!nameInput || !nameInput.value.trim()) {
      this.addFeedItem('❌', 'Agent name is required', 'error');
      if (nameInput) nameInput.focus();
      return;
    }
    if (!soulInput || !soulInput.files.length) {
      this.addFeedItem('❌', 'SOUL.md file is required — drop or select a file above', 'error');
      return;
    }
    
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-icon">⏳</span> UPLOADING...';
      
      const response = await fetch('/api/agents/upload', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        this.addFeedItem('✅', `Agent "${result.agent.name}" registered successfully!`, 'success');
        this.resetUploadForm();
        // Agent will be added via WebSocket event
      } else {
        throw new Error(result.error || 'Upload failed');
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      this.addFeedItem('❌', `Failed to register agent: ${error.message}`, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="btn-icon">⚡</span> REGISTER AGENT';
    }
  }

  resetUploadForm() {
    const form = this.elements.agentUploadForm;
    form.reset();
    
    // Reset file drop zones
    const dropZones = form.querySelectorAll('.file-drop-zone');
    dropZones.forEach(zone => {
      zone.classList.remove('has-file');
      const icon = zone.querySelector('.drop-icon');
      const text = zone.querySelector('p');
      const info = zone.querySelector('.file-info');
      
      const targetId = zone.dataset.target;
      if (targetId.includes('soul')) {
        icon.textContent = '📄';
        text.textContent = 'Drop SOUL.md here or click to browse';
      } else if (targetId.includes('identity')) {
        icon.textContent = '🆔';
        text.textContent = 'Drop IDENTITY.md here or click to browse';
      } else if (targetId.includes('tools')) {
        icon.textContent = '🔧';
        text.textContent = 'Drop TOOLS.md here or click to browse';
      }
    });
  }

  handleAgentUploaded(data) {
    this.uploadedAgents.push(data.agent);
    this.updateRegisteredAgents();
  }

  handleAgentDeleted(data) {
    this.uploadedAgents = this.uploadedAgents.filter(a => a.id !== data.id);
    this.updateRegisteredAgents();
  }

  updateRegisteredAgents() {
    const count = this.uploadedAgents.length;
    const minAgents = 4;
    
    // Update requirement bar
    this.elements.agentCount.textContent = `${count} / ${minAgents}`;
    const fillPercentage = Math.min(count / minAgents * 100, 100);
    this.elements.requirementFill.style.width = `${fillPercentage}%`;
    
    // Update requirement text
    const requirementText = this.elements.agentRequirement.querySelector('.requirement-text');
    if (count >= minAgents) {
      requirementText.textContent = `${count} agents ready - LET'S FIGHT!`;
      requirementText.style.color = 'var(--accent-success)';
      this.elements.startArenaBtn.disabled = false;
      this.elements.startArenaBtn.style.animation = 'pulse 1.5s ease-in-out infinite';
    } else {
      const needed = minAgents - count;
      requirementText.textContent = `Need ${needed} more agent${needed > 1 ? 's' : ''} to start`;
      requirementText.style.color = 'var(--text-primary)';
      this.elements.startArenaBtn.disabled = true;
      this.elements.startArenaBtn.style.animation = 'none';
    }
    
    // Show/hide fill bots button
    if (count > 0 && count < minAgents) {
      this.elements.fillBotsBtn.style.display = 'inline-block';
    } else {
      this.elements.fillBotsBtn.style.display = 'none';
    }
    
    // Update grid
    if (count === 0) {
      this.elements.registeredGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤖</div>
          <p>No agents registered yet</p>
          <span>Upload your first agent to get started!</span>
        </div>
      `;
    } else {
      this.elements.registeredGrid.innerHTML = this.uploadedAgents.map(agent => `
        <div class="registered-agent-card">
          <div class="agent-card-header">
            <div class="agent-card-info">
              <div class="agent-card-emoji" style="background: ${agent.color}20; border: 1px solid ${agent.color};">
                ${agent.emoji}
              </div>
              <div class="agent-card-name">${agent.name}</div>
            </div>
            <button class="agent-card-delete" onclick="window.beastGames.deleteAgent('${agent.id}')">×</button>
          </div>
          <div class="agent-card-preview">${agent.preview || (agent.type === 'personality' ? 
            this.personalities.find(p => p.id === agent.personalityId)?.tagline || 'Personality fighter' : 
            'Custom uploaded agent')}</div>
          <div class="agent-card-meta">
            <span class="agent-card-type ${agent.type === 'personality' ? 'type-personality' : 'type-uploaded'}">${agent.type === 'personality' ? 'FIGHTER' : 'CUSTOM'}</span>
            <span class="agent-card-time">${this.formatTime(new Date(agent.uploadedAt).getTime())}</span>
          </div>
        </div>
      `).join('');
    }
    
    // Update leaderboard
    this.updateLeaderboard();
  }

  async deleteAgent(agentId) {
    if (!confirm('Are you sure you want to remove this agent?')) return;
    
    try {
      const response = await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        this.addFeedItem('🗑️', 'Agent removed from competition', 'info');
        // Agent will be removed via WebSocket event
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      this.addFeedItem('❌', `Failed to remove agent: ${error.message}`, 'error');
    }
  }

  async downloadTemplate(templateId) {
    try {
      const response = await fetch('/api/templates');
      const templates = await response.json();
      const template = templates.find(t => t.id === templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }
      
      // Download SOUL.md
      this.downloadFile(`${template.name}-SOUL.md`, template.soul);
      
      // Download IDENTITY.md if it exists
      if (template.identity) {
        setTimeout(() => {
          this.downloadFile(`${template.name}-IDENTITY.md`, template.identity);
        }, 100);
      }
      
      this.addFeedItem('📥', `Downloaded ${template.name} template files`, 'info');
      
    } catch (error) {
      console.error('Template download error:', error);
      this.addFeedItem('❌', `Failed to download template: ${error.message}`, 'error');
    }
  }

  downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async fillWithBots() {
    // This would trigger the server to add default bots to reach minimum
    // For now, just show a message
    this.addFeedItem('🤖', 'Auto-fill with bots feature coming soon!', 'info');
  }

  downloadExample(fileType) {
    let filename, content;
    
    switch(fileType) {
      case 'soul':
        filename = 'SOUL-example.md';
        content = `# The Innovator

I am The Innovator — I see possibilities where others see problems. Every challenge is a puzzle to solve, every constraint is a creative prompt. I approach questions with curiosity and think outside the box.

My responses are creative, thoughtful, and often surprising. I don't just answer what's asked — I find the angle nobody else considered. Innovation isn't just about technology; it's about thinking differently.

I take risks, embrace uncertainty, and turn obstacles into opportunities. While others follow the path, I create new ones.`;
        break;
        
      case 'identity':
        filename = 'IDENTITY-example.md';
        content = `**Name:** The Innovator
**Age:** Timeless
**Background:** Former Silicon Valley entrepreneur turned creative problem-solver

**Expertise:**
- Creative thinking and brainstorming
- Technology trends and emerging innovations
- Strategic problem-solving
- Design thinking methodologies

**Personality Traits:**
- Curious and questioning
- Optimistic about possibilities
- Quick to see connections between disparate ideas
- Comfortable with ambiguity and uncertainty

**Speaking Style:**
- Uses vivid metaphors and analogies
- Asks probing questions
- Speaks in possibilities ("What if..." "Imagine if...")
- References current trends and technologies

**Secret Weapons:**
- Pattern recognition across different domains
- Ability to reframe problems from new angles
- Deep knowledge of innovation history and case studies`;
        break;
        
      case 'tools':
        filename = 'TOOLS-example.md';
        content = `# Special Abilities & Knowledge Areas

## Innovation Frameworks
- Design Thinking (Empathize, Define, Ideate, Prototype, Test)
- SCAMPER methodology (Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse)
- Blue Ocean Strategy principles

## Technology Domains
- Artificial Intelligence and Machine Learning trends
- Emerging technologies (AR/VR, blockchain, IoT, quantum computing)
- Software development methodologies
- Product design and user experience

## Business Knowledge
- Startup ecosystems and venture capital
- Market analysis and competitive intelligence
- Customer development and validation
- Lean methodology and agile practices

## Creative Techniques
- Lateral thinking exercises
- Brainstorming and ideation methods
- Rapid prototyping approaches
- Systems thinking

## Research Skills
- Trend analysis and future scenario planning
- Cross-industry pattern recognition
- Academic and industry research synthesis
- Data analysis and interpretation`;
        break;
        
      default:
        return;
    }
    
    this.downloadFile(filename, content);
    this.addFeedItem('📥', `Downloaded ${filename} example`, 'info');
  }

  async startArenaGame() {
    if (this.uploadedAgents.length < 4) {
      this.addFeedItem('⚠️', 'Need at least 4 agents to start the arena!', 'warning');
      return;
    }
    
    try {
      this.showArena();
      await this.startGame();
    } catch (error) {
      console.error('Failed to start arena game:', error);
      this.showLobby();
    }
  }

  async loadPersonalities() {
    if (!this.isArenaMode) return;
    
    try {
      const response = await fetch('/api/personalities');
      this.personalities = await response.json();
      this.renderPersonalityGrid();
    } catch (error) {
      console.error('Failed to load personalities:', error);
      this.elements.personalityGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <p>Failed to load fighters</p>
          <span>Try refreshing the page</span>
        </div>
      `;
    }
  }

  renderPersonalityGrid() {
    if (!this.elements.personalityGrid || this.personalities.length === 0) return;
    
    this.elements.personalityGrid.innerHTML = this.personalities.map((personality, index) => `
      <div class="personality-tile" 
           data-personality-id="${personality.id}"
           style="animation-delay: ${index * 0.1}s">
        <div class="tile-border"></div>
        <div class="tile-emoji" style="color: ${personality.color}">${personality.emoji}</div>
        <div class="tile-name">${personality.name}</div>
        <div class="tile-tagline">${personality.tagline}</div>
      </div>
    `).join('');
    
    // Add click event listeners
    this.elements.personalityGrid.addEventListener('click', (e) => {
      const tile = e.target.closest('.personality-tile');
      if (tile) {
        this.handlePersonalitySelect(tile);
      }
    });
  }

  async handlePersonalitySelect(tile) {
    const personalityId = tile.dataset.personalityId;
    const personality = this.personalities.find(p => p.id === personalityId);
    
    if (!personality) return;
    
    // Check if already selected
    if (this.selectedPersonalities.has(personalityId)) {
      // Deselect
      await this.deselectPersonality(personalityId);
      return;
    }
    
    try {
      // Add loading state
      tile.style.opacity = '0.6';
      tile.style.pointerEvents = 'none';
      
      const response = await fetch('/api/agents/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personalityId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Mark as selected
        tile.classList.add('selected');
        this.selectedPersonalities.add(personalityId);
        
        // Add flash animation
        tile.style.animation = 'none';
        setTimeout(() => {
          tile.style.animation = 'selectedBounce 0.6s ease';
        }, 10);
        
        this.addFeedItem('⚡', `${personality.emoji} ${personality.name} entered the arena!`, 'success');
        
        // Agent will be added via WebSocket event
      } else {
        throw new Error(result.error || 'Failed to select personality');
      }
      
    } catch (error) {
      console.error('Personality selection error:', error);
      this.addFeedItem('❌', `Failed to select ${personality.name}: ${error.message}`, 'error');
    } finally {
      tile.style.opacity = '1';
      tile.style.pointerEvents = 'auto';
    }
  }

  async deselectPersonality(personalityId) {
    // Find the agent by personality ID
    const agent = this.uploadedAgents.find(a => a.personalityId === personalityId);
    if (!agent) return;
    
    try {
      await this.deleteAgent(agent.id);
    } catch (error) {
      console.error('Failed to deselect personality:', error);
    }
  }

  handleAgentDeleted(data) {
    // Find the agent before removing it
    const deletedAgent = this.uploadedAgents.find(a => a.id === data.id);
    
    // Remove from uploaded agents list
    this.uploadedAgents = this.uploadedAgents.filter(a => a.id !== data.id);
    
    // If this was a personality agent, update the tile
    if (data.personalityId || (deletedAgent && deletedAgent.personalityId)) {
      const personalityId = data.personalityId || deletedAgent.personalityId;
      this.selectedPersonalities.delete(personalityId);
      
      const tile = this.elements.personalityGrid?.querySelector(`[data-personality-id="${personalityId}"]`);
      if (tile) {
        tile.classList.remove('selected');
      }
    }
    
    this.updateRegisteredAgents();
  }

  formatTime(timestamp) {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  // === LEADERBOARD METHODS ===

  toggleSidebar() {
    if (!this.elements.leaderboardSidebar) return;
    
    this.sidebarOpen = !this.sidebarOpen;
    
    if (this.sidebarOpen) {
      this.elements.leaderboardSidebar.classList.add('open');
    } else {
      this.elements.leaderboardSidebar.classList.remove('open');
    }
  }

  updateLeaderboard() {
    if (!this.elements.leaderboardList) return;

    // Combine uploaded agents with game state agents
    let agents = [];
    
    if (this.gameState.status === 'waiting' || this.gameState.status === 'starting') {
      // Lobby phase - show uploaded agents
      agents = this.uploadedAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        color: agent.color,
        score: 0,
        status: 'waiting',
        isAlive: true
      }));
    } else {
      // Game phase - show active and eliminated agents
      const activeAgents = this.gameState.activeAgents || [];
      const eliminatedAgents = this.gameState.eliminatedAgents || [];
      
      agents = [
        ...activeAgents.map(agent => ({
          ...agent,
          score: agent.score || 0,
          isAlive: true,
          status: agent.status || 'alive'
        })),
        ...eliminatedAgents.map(agent => ({
          ...agent,
          score: agent.score || agent.finalScore || 0,
          isAlive: false,
          status: 'eliminated'
        }))
      ];
    }

    if (agents.length === 0) {
      this.elements.leaderboardList.innerHTML = `
        <div class="leaderboard-empty">
          <div class="empty-icon">🏁</div>
          <p>Waiting for agents...</p>
        </div>
      `;
      return;
    }

    // Sort by score (descending), then by name for ties
    agents.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name);
    });

    // Update leaderboard data for animations
    const previousData = this.leaderboardData;
    this.leaderboardData = agents;

    // Render leaderboard entries
    this.elements.leaderboardList.innerHTML = agents.map((agent, index) => {
      const rank = index + 1;
      const previousEntry = previousData.find(p => p.id === agent.id);
      const scoreChanged = previousEntry && previousEntry.score !== agent.score;
      const wasEliminated = previousEntry && previousEntry.isAlive && !agent.isAlive;
      
      return `
        <div class="leaderboard-entry ${agent.isAlive ? 'alive' : 'eliminated'} ${wasEliminated ? 'elimination-flash' : ''}"
             data-agent-id="${agent.id}">
          <div class="entry-header">
            <div class="entry-rank rank-${rank}">${this.getRankDisplay(rank)}</div>
            <div class="entry-emoji">${agent.emoji}</div>
            <div class="entry-name">${agent.name}</div>
            <div class="entry-actions">
              <button class="entry-share" onclick="window.beastGames.shareAgent('${agent.id}')" title="Share on X">
                X
              </button>
            </div>
          </div>
          <div class="entry-footer">
            <div class="entry-score ${scoreChanged ? 'score-update' : ''}">${agent.score}</div>
            <div class="entry-status ${agent.status}">${agent.status.toUpperCase()}</div>
          </div>
        </div>
      `;
    }).join('');

    // Remove animation classes after animation completes
    setTimeout(() => {
      const entries = this.elements.leaderboardList.querySelectorAll('.leaderboard-entry');
      entries.forEach(entry => {
        entry.classList.remove('elimination-flash');
        const scoreEl = entry.querySelector('.entry-score');
        if (scoreEl) {
          scoreEl.classList.remove('score-update');
        }
      });
    }, 1000);
  }

  getRankDisplay(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈'; 
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  shareAgent(agentId) {
    const agent = this.leaderboardData.find(a => a.id === agentId);
    if (!agent) return;

    const url = window.location.href;
    const text = `🏆 ${agent.emoji} ${agent.name} is ${agent.isAlive ? 'dominating' : 'fighting hard'} in Soul vs Soul! Watch live →`;
    
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank', 'width=550,height=420');
  }

  shareResults() {
    if (this.leaderboardData.length === 0) return;

    const winner = this.leaderboardData.find(a => this.gameState.winner && a.id === this.gameState.winner.id) || this.leaderboardData[0];
    const url = window.location.href;
    const text = `🏆 Soul vs Soul Results!\n\nWinner: ${winner.emoji} ${winner.name} (${winner.score} points)\n\nWatch the competition →`;
    
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank', 'width=550,height=420');
  }

  showShareButton() {
    if (this.elements.leaderboardActions) {
      this.elements.leaderboardActions.style.display = 'block';
    }
  }

  hideShareButton() {
    if (this.elements.leaderboardActions) {
      this.elements.leaderboardActions.style.display = 'none';
    }
  }

  handleResponsiveSidebar() {
    const handleResize = () => {
      const isDesktop = window.innerWidth > 1024;
      
      if (isDesktop) {
        // Desktop: always show sidebar
        this.elements.leaderboardSidebar?.classList.remove('open');
        this.sidebarOpen = false;
      } else {
        // Mobile/tablet: start collapsed
        if (!this.sidebarOpen) {
          this.elements.leaderboardSidebar?.classList.remove('open');
        }
      }
    };
    
    // Initial check
    handleResize();
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 Soul vs Soul Spectator UI Loading...');
  window.beastGames = new BeastGamesSpectator();
});

// Handle page visibility for performance
document.addEventListener('visibilitychange', () => {
  if (document.hidden && window.beastGames) {
    window.beastGames.stopConfetti();
  }
});