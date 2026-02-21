const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const moment = require('moment');
const fs = require('fs');
const multer = require('multer');
const GameEngine = require('./GameEngine');
const Logger = require('./Logger');

class WebSpectatorServer {
  constructor(port = 3003) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.gameEngine = null;
    this.gameState = {
      status: 'waiting', // waiting, running, finished
      round: 0,
      activeAgents: [],
      eliminatedAgents: [],
      currentChallenge: null,
      winner: null,
      gameLog: [],
      stats: null
    };
    
    this.uploadedAgents = [];
    this.isArenaMode = process.env.NODE_ENV !== 'spectator'; // Arena mode by default
    this.setupFileUpload();
    this.setupRoutes();
    this.setupSocketEvents();
  }

  setupFileUpload() {
    // Ensure data directories exist
    const agentsDir = path.join(__dirname, '../data/agents');
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    // Configure multer for file uploads
    this.upload = multer({
      dest: 'temp/',
      limits: {
        fileSize: 50 * 1024, // 50KB max per file
        files: 3 // max 3 files (SOUL.md, IDENTITY.md, TOOLS.md)
      },
      fileFilter: (req, file, cb) => {
        // Only accept .md and .txt files
        if (file.originalname.match(/\.(md|txt)$/)) {
          cb(null, true);
        } else {
          cb(new Error('Only .md and .txt files are allowed!'), false);
        }
      }
    });

    // Load existing uploaded agents
    this.loadUploadedAgents();
    this.loadLeaderboard();
  }

  loadUploadedAgents() {
    try {
      const agentsDir = path.join(__dirname, '../data/agents');
      if (fs.existsSync(agentsDir)) {
        const files = fs.readdirSync(agentsDir);
        this.uploadedAgents = files
          .filter(file => file.endsWith('.json'))
          .map(file => {
            try {
              const filePath = path.join(agentsDir, file);
              return JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } catch (err) {
              console.error(`Error reading agent file ${file}:`, err);
              return null;
            }
          })
          .filter(agent => agent !== null);
        
        console.log(`📦 Loaded ${this.uploadedAgents.length} uploaded agents`);
      }
    } catch (error) {
      console.error('Error loading uploaded agents:', error);
      this.uploadedAgents = [];
    }
  }

  loadLeaderboard() {
    try {
      const lbPath = path.join(__dirname, '../data/leaderboard.json');
      if (fs.existsSync(lbPath)) {
        this.allTimeLeaderboard = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
      } else {
        this.allTimeLeaderboard = {};
      }
      console.log(`🏆 Loaded ${Object.keys(this.allTimeLeaderboard).length} leaderboard entries`);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      this.allTimeLeaderboard = {};
    }
  }

  saveLeaderboard() {
    try {
      const lbPath = path.join(__dirname, '../data/leaderboard.json');
      fs.writeFileSync(lbPath, JSON.stringify(this.allTimeLeaderboard, null, 2));
    } catch (error) {
      console.error('Error saving leaderboard:', error);
    }
  }

  recordGameResults() {
    const now = new Date().toISOString();
    const allAgents = [
      ...(this.gameEngine.gameState.activeAgents || []),
      ...(this.gameEngine.gameState.eliminatedAgents || [])
    ];
    const winner = this.gameEngine.gameState.winner;

    for (const agent of allAgents) {
      const id = agent.id;
      if (!this.allTimeLeaderboard[id]) {
        const uploadedAgent = this.uploadedAgents.find(a => a.id === id);
        this.allTimeLeaderboard[id] = {
          id,
          name: agent.name,
          emoji: agent.emoji || '🤖',
          wins: 0,
          gamesPlayed: 0,
          totalScore: 0,
          lastPlayed: now,
          isCustom: uploadedAgent ? uploadedAgent.type === 'uploaded' : false
        };
      }

      const entry = this.allTimeLeaderboard[id];
      entry.name = agent.name;
      entry.emoji = agent.emoji || entry.emoji;
      entry.gamesPlayed += 1;
      entry.totalScore += (agent.score || 0);
      entry.lastPlayed = now;

      if (winner && winner.id === id) {
        entry.wins += 1;
      }
    }

    this.saveLeaderboard();
  }

  generateAgentEmoji() {
    const emojis = ['🤖', '🦾', '🧠', '⚡', '🔥', '🌟', '💎', '🚀', '🎯', '⚔️', 
                   '🛡️', '🎭', '🎨', '💫', '🌊', '⚛️', '🔮', '🦋', '🌙', '🎪'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  generateAgentColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
                   '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
                   '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  setupRoutes() {
    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, '../public')));
    this.app.use(express.json());

    // API endpoints
    this.app.get('/api/status', (req, res) => {
      res.json({
        ...this.gameState,
        connectedSpectators: this.io.sockets.sockets.size,
        timestamp: moment().toISOString()
      });
    });

    this.app.post('/api/start', async (req, res) => {
      if (this.gameState.status === 'running') {
        return res.status(400).json({ error: 'Game already running' });
      }

      try {
        await this.startGame();
        res.json({ success: true, message: 'Game started!' });
      } catch (error) {
        console.error('Failed to start game:', error);
        res.status(500).json({ error: 'Failed to start game' });
      }
    });

    // Personality endpoints (works in all modes)
    this.app.get('/api/personalities', (req, res) => {
      try {
        const personalitiesPath = path.join(__dirname, '../data/personalities.json');
        if (!fs.existsSync(personalitiesPath)) {
          return res.status(404).json({ error: 'Personalities file not found' });
        }
        
        const personalities = JSON.parse(fs.readFileSync(personalitiesPath, 'utf8'));
        res.json(personalities);
      } catch (error) {
        console.error('Error loading personalities:', error);
        res.status(500).json({ error: 'Failed to load personalities' });
      }
    });

    this.app.post('/api/agents/select', async (req, res) => {
      try {
        const { personalityId, customName } = req.body;
        
        if (!personalityId) {
          return res.status(400).json({ error: 'personalityId is required' });
        }

        // Load the personality data
        const personalitiesPath = path.join(__dirname, '../data/personalities.json');
        if (!fs.existsSync(personalitiesPath)) {
          return res.status(404).json({ error: 'Personalities file not found' });
        }
        
        const personalities = JSON.parse(fs.readFileSync(personalitiesPath, 'utf8'));
        const personality = personalities.find(p => p.id === personalityId);
        
        if (!personality) {
          return res.status(404).json({ error: 'Personality not found' });
        }

        // Create agent object from personality
        const agentId = `personality_${personalityId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const agent = {
          id: agentId,
          name: customName || personality.name,
          soul: personality.soul,
          identity: `**Name:** ${customName || personality.name}\n**Personality:** ${personality.personality}\n**Tagline:** ${personality.tagline}`,
          tools: '', // Personalities don't have tools by default
          emoji: personality.emoji,
          color: personality.color,
          uploadedAt: new Date().toISOString(),
          type: 'personality',
          personalityId: personalityId
        };

        // Save to file system (same as uploaded agents)
        const agentFile = path.join(__dirname, '../data/agents', `${agentId}.json`);
        fs.writeFileSync(agentFile, JSON.stringify(agent, null, 2));

        // Add to uploaded agents list
        this.uploadedAgents.push(agent);

        // Broadcast to connected clients
        this.broadcast('agent_uploaded', { agent });

        res.json({ 
          success: true, 
          agent: { 
            id: agent.id, 
            name: agent.name, 
            emoji: agent.emoji, 
            color: agent.color,
            preview: personality.tagline,
            type: 'personality'
          } 
        });

      } catch (error) {
        console.error('Select personality error:', error);
        res.status(500).json({ error: 'Failed to select personality' });
      }
    });

    // Agent upload endpoints (only in arena mode)
    if (this.isArenaMode) {
      this.app.post('/api/agents/upload', this.upload.fields([
        { name: 'soul', maxCount: 1 },
        { name: 'identity', maxCount: 1 }, 
        { name: 'tools', maxCount: 1 }
      ]), async (req, res) => {
        try {
          const { agentName } = req.body;
          
          if (!agentName || !req.files || !req.files.soul) {
            return res.status(400).json({ 
              error: 'Agent name and SOUL.md file are required' 
            });
          }

          // Read uploaded files
          const soulContent = fs.readFileSync(req.files.soul[0].path, 'utf8');
          const identityContent = req.files.identity ? 
            fs.readFileSync(req.files.identity[0].path, 'utf8') : '';
          const toolsContent = req.files.tools ? 
            fs.readFileSync(req.files.tools[0].path, 'utf8') : '';

          // Extract agent name from IDENTITY.md if not provided
          let finalAgentName = agentName;
          if (identityContent && identityContent.includes('**Name:**')) {
            const nameMatch = identityContent.match(/\*\*Name:\*\*\s*(.+)/);
            if (nameMatch) {
              finalAgentName = nameMatch[1].trim();
            }
          }

          // Create agent object
          const agentId = `uploaded_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const agent = {
            id: agentId,
            name: finalAgentName,
            soul: soulContent,
            identity: identityContent,
            tools: toolsContent,
            emoji: this.generateAgentEmoji(),
            color: this.generateAgentColor(),
            uploadedAt: new Date().toISOString(),
            type: 'uploaded'
          };

          // Save to file system
          const agentFile = path.join(__dirname, '../data/agents', `${agentId}.json`);
          fs.writeFileSync(agentFile, JSON.stringify(agent, null, 2));

          // Add to uploaded agents list
          this.uploadedAgents.push(agent);

          // Clean up temp files
          Object.values(req.files).flat().forEach(file => {
            try {
              fs.unlinkSync(file.path);
            } catch (err) {
              console.error('Error cleaning up temp file:', err);
            }
          });

          // Broadcast to connected clients
          this.broadcast('agent_uploaded', { agent });

          res.json({ 
            success: true, 
            agent: { 
              id: agent.id, 
              name: agent.name, 
              emoji: agent.emoji, 
              color: agent.color,
              preview: soulContent.split('\n')[0] || 'No preview available'
            } 
          });

        } catch (error) {
          console.error('Upload error:', error);
          res.status(500).json({ error: 'Failed to upload agent' });
        }
      });

      this.app.get('/api/agents', (req, res) => {
        const agentPreviews = this.uploadedAgents.map(agent => ({
          id: agent.id,
          name: agent.name,
          emoji: agent.emoji,
          color: agent.color,
          preview: agent.soul.split('\n')[0] || 'No preview available',
          uploadedAt: agent.uploadedAt
        }));
        res.json(agentPreviews);
      });

      this.app.delete('/api/agents/:id', (req, res) => {
        try {
          const { id } = req.params;
          const agentIndex = this.uploadedAgents.findIndex(a => a.id === id);
          
          if (agentIndex === -1) {
            return res.status(404).json({ error: 'Agent not found' });
          }

          // Remove from filesystem
          const agentFile = path.join(__dirname, '../data/agents', `${id}.json`);
          if (fs.existsSync(agentFile)) {
            fs.unlinkSync(agentFile);
          }

          // Get the agent data before removal for broadcast
          const deletedAgent = this.uploadedAgents[agentIndex];
          
          // Remove from memory
          this.uploadedAgents.splice(agentIndex, 1);

          // Broadcast to connected clients
          this.broadcast('agent_deleted', { 
            id, 
            personalityId: deletedAgent.personalityId 
          });

          res.json({ success: true });
        } catch (error) {
          console.error('Delete error:', error);
          res.status(500).json({ error: 'Failed to delete agent' });
        }
      });

      this.app.get('/api/templates', (req, res) => {
        try {
          const templatesDir = path.join(__dirname, '../data/templates');
          const templateDirs = fs.readdirSync(templatesDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

          const templates = templateDirs.map(templateName => {
            try {
              const templateDir = path.join(templatesDir, templateName);
              const soulPath = path.join(templateDir, 'SOUL.md');
              const identityPath = path.join(templateDir, 'IDENTITY.md');

              const soul = fs.existsSync(soulPath) ? fs.readFileSync(soulPath, 'utf8') : '';
              const identity = fs.existsSync(identityPath) ? fs.readFileSync(identityPath, 'utf8') : '';
              
              return {
                id: templateName,
                name: templateName.split('-').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' '),
                soul,
                identity,
                preview: soul.split('\n')[0] || 'No preview available'
              };
            } catch (err) {
              console.error(`Error reading template ${templateName}:`, err);
              return null;
            }
          }).filter(t => t !== null);

          res.json(templates);
        } catch (error) {
          console.error('Templates error:', error);
          res.status(500).json({ error: 'Failed to load templates' });
        }
      });
    }

    // All-time leaderboard
    this.app.get('/api/leaderboard', (req, res) => {
      const entries = Object.values(this.allTimeLeaderboard || {}).map(e => ({
        ...e,
        winRate: e.gamesPlayed > 0 ? Math.round((e.wins / e.gamesPlayed) * 100) : 0
      }));
      entries.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.totalScore - a.totalScore);
      res.json(entries);
    });

    // Main route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });
  }

  setupSocketEvents() {
    this.io.on('connection', (socket) => {
      console.log(`🌐 Spectator connected: ${socket.id}`);
      
      // Send current game state to new connection
      socket.emit('game_state', this.gameState);
      
      socket.on('disconnect', () => {
        console.log(`👋 Spectator disconnected: ${socket.id}`);
      });

      socket.on('request_game_state', () => {
        socket.emit('game_state', this.gameState);
      });
    });
  }

  async startGame() {
    if (this.gameEngine) {
      return; // Game already initialized
    }

    console.log('🎮 Starting Soul vs Soul with web spectator mode...');
    
    const logger = new Logger();
    this.gameEngine = new GameEngine(logger);

    // In arena mode, pass uploaded agents to the game engine
    if (this.isArenaMode && this.uploadedAgents.length > 0) {
      console.log(`🏟️ Arena mode: Using ${this.uploadedAgents.length} uploaded agents`);
      this.gameEngine.setUploadedAgents(this.uploadedAgents);
    }
    
    // Hook into game engine events
    this.setupGameEventListeners();
    
    this.gameState.status = 'running';
    this.broadcast('game_started', { 
      message: 'Soul vs Soul competition begins!',
      timestamp: moment().toISOString()
    });

    try {
      await this.gameEngine.initialize();
      
      // Update game state with initialized agents
      this.gameState.activeAgents = this.gameEngine.gameState.activeAgents;
      this.broadcast('agents_initialized', { 
        agents: this.gameState.activeAgents,
        timestamp: moment().toISOString()
      });

      // Start the competition
      await this.gameEngine.startCompetition();
      
    } catch (error) {
      console.error('Game error:', error);
      this.gameState.status = 'error';
      this.broadcast('game_error', { error: error.message });
    }
  }

  setupGameEventListeners() {
    // We'll modify the GameEngine to emit these events
    // For now, we'll use a polling approach with method hooking
    
    // Hook into GameEngine methods to emit events
    const originalRunRound = this.gameEngine.runRound.bind(this.gameEngine);
    this.gameEngine.runRound = async (roundInfo) => {
      this.gameState.round = this.gameEngine.gameState.round;
      
      this.broadcast('round_start', {
        round: this.gameState.round,
        roundName: roundInfo.name,
        activeAgents: this.gameEngine.gameState.activeAgents,
        eliminateCount: roundInfo.eliminate,
        timestamp: moment().toISOString()
      });

      const result = await originalRunRound(roundInfo);
      
      this.gameState.activeAgents = this.gameEngine.gameState.activeAgents;
      this.gameState.eliminatedAgents = this.gameEngine.gameState.eliminatedAgents;
      
      return result;
    };

    // Hook challenge announcements
    const originalRunChallenge = this.gameEngine.challengeManager.runChallenge.bind(this.gameEngine.challengeManager);
    this.gameEngine.challengeManager.runChallenge = async (challenge, agents, agentManager) => {
      this.gameState.currentChallenge = challenge;
      
      this.broadcast('challenge_announce', {
        challenge: {
          name: challenge.name,
          description: challenge.description,
          type: challenge.type,
          icon: this.getChallengeIcon(challenge.type)
        },
        timestamp: moment().toISOString()
      });

      // Show thinking indicator for each agent
      for (const agent of agents) {
        this.broadcast('agent_thinking', {
          agent: {
            id: agent.id,
            name: agent.name,
            emoji: agent.emoji
          },
          challenge: challenge.name,
          timestamp: moment().toISOString()
        });
        
        // Add delay for dramatic effect
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const results = await originalRunChallenge(challenge, agents, agentManager);
      
      // Emit results with delay for animation
      this.broadcast('results', {
        results: results.map(r => ({
          agent: r.agent,
          score: r.score,
          response: r.response,
          reasoning: r.reasoning
        })),
        challenge: challenge.name,
        timestamp: moment().toISOString()
      });

      return results;
    };

    // Hook eliminations
    const originalEliminateAgents = this.gameEngine.eliminateAgents.bind(this.gameEngine);
    this.gameEngine.eliminateAgents = (results, eliminateCount) => {
      const eliminated = originalEliminateAgents(results, eliminateCount);
      
      // Emit elimination events one by one for drama
      setTimeout(() => {
        eliminated.forEach((agent, index) => {
          setTimeout(() => {
            this.broadcast('elimination', {
              agent: agent,
              round: this.gameEngine.gameState.round,
              finalScore: results.find(r => r.agent.id === agent.id)?.score || 0,
              timestamp: moment().toISOString()
            });
          }, index * 2000); // 2 second delays between eliminations
        });
      }, 1000);

      return eliminated;
    };

    // Hook winner announcement
    const originalConcludeGame = this.gameEngine.concludeGame.bind(this.gameEngine);
    this.gameEngine.concludeGame = async () => {
      this.gameState.winner = this.gameEngine.gameState.winner;
      this.gameState.stats = this.gameEngine.generateFinalStats();
      this.gameState.status = 'finished';
      
      this.broadcast('winner', {
        winner: this.gameState.winner,
        stats: this.gameState.stats,
        timestamp: moment().toISOString()
      });

      // Record all-time leaderboard
      this.recordGameResults();

      await originalConcludeGame();
    };

    // Hook trash talk
    const originalRunInterRoundInteractions = this.gameEngine.runInterRoundInteractions.bind(this.gameEngine);
    this.gameEngine.runInterRoundInteractions = async () => {
      const interactions = await originalRunInterRoundInteractions();
      
      interactions.forEach((interaction, index) => {
        setTimeout(() => {
          this.broadcast('trash_talk', {
            ...interaction,
            timestamp: moment().toISOString()
          });
        }, index * 1500); // Stagger trash talk
      });

      return interactions;
    };
  }

  getChallengeIcon(challengeType) {
    const icons = {
      'trivia': '🧠',
      'coding': '💻', 
      'persuasion': '🗣️',
      'strategy': '🧩',
      'riddle': '🔮',
      'creative': '🎨'
    };
    return icons[challengeType] || '🎯';
  }

  getAgentCount() {
    return this.isArenaMode ? this.uploadedAgents.length : 8;
  }

  canStartGame() {
    if (!this.isArenaMode) return true;
    return this.uploadedAgents.length >= 4; // Minimum 4 agents for arena mode
  }

  broadcast(event, data) {
    console.log(`📡 Broadcasting: ${event}`);
    this.io.emit(event, data);
    
    // Also update game log
    this.gameState.gameLog.push({
      event,
      data,
      timestamp: moment().toISOString()
    });
  }

  async start() {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`🌐 Soul vs Soul Web Spectator running at http://localhost:${this.port}`);
        console.log(`📡 WebSocket server ready for spectators`);
        resolve();
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('🛑 Web spectator server stopped');
        resolve();
      });
    });
  }
}

module.exports = WebSpectatorServer;

// If run directly
if (require.main === module) {
  const port = process.env.PORT || 3003;
  const server = new WebSpectatorServer(port);
  server.start().catch(console.error);
}