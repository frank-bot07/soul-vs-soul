const chalk = require('chalk');
const moment = require('moment');
const AgentManager = require('./AgentManager');
const ChallengeManager = require('./ChallengeManager');
const UI = require('./UI');

class GameEngine {
  constructor(logger) {
    this.logger = logger;
    this.agentManager = new AgentManager(logger);
    this.challengeManager = new ChallengeManager(logger);
    this.ui = new UI();
    this.uploadedAgents = null;
    
    this.gameState = {
      round: 0,
      activeAgents: [],
      eliminatedAgents: [],
      gameLog: [],
      startTime: null,
      winner: null
    };
    
    this.roundStructure = [
      { name: 'Round 1', startingAgents: 8, eliminate: 2 },
      { name: 'Round 2', startingAgents: 6, eliminate: 2 },
      { name: 'Round 3', startingAgents: 4, eliminate: 2 },
      { name: 'Final', startingAgents: 2, eliminate: 1 }
    ];
  }

  setUploadedAgents(uploadedAgents) {
    this.uploadedAgents = uploadedAgents;
    this.updateRoundStructure(uploadedAgents.length);
  }

  updateRoundStructure(agentCount) {
    // Dynamic round structure based on agent count (4-12 agents)
    if (agentCount <= 4) {
      this.roundStructure = [
        { name: 'Semi-Final', startingAgents: agentCount, eliminate: agentCount - 2 },
        { name: 'Final', startingAgents: 2, eliminate: 1 }
      ];
    } else if (agentCount <= 6) {
      this.roundStructure = [
        { name: 'Round 1', startingAgents: agentCount, eliminate: agentCount - 4 },
        { name: 'Round 2', startingAgents: 4, eliminate: 2 },
        { name: 'Final', startingAgents: 2, eliminate: 1 }
      ];
    } else if (agentCount <= 8) {
      this.roundStructure = [
        { name: 'Round 1', startingAgents: agentCount, eliminate: agentCount - 6 },
        { name: 'Round 2', startingAgents: 6, eliminate: 2 },
        { name: 'Round 3', startingAgents: 4, eliminate: 2 },
        { name: 'Final', startingAgents: 2, eliminate: 1 }
      ];
    } else {
      // For 9-12 agents
      this.roundStructure = [
        { name: 'Round 1', startingAgents: agentCount, eliminate: agentCount - 8 },
        { name: 'Round 2', startingAgents: 8, eliminate: 2 },
        { name: 'Round 3', startingAgents: 6, eliminate: 2 },
        { name: 'Round 4', startingAgents: 4, eliminate: 2 },
        { name: 'Final', startingAgents: 2, eliminate: 1 }
      ];
    }
    
    console.log(`🎯 Updated round structure for ${agentCount} agents:`, 
      this.roundStructure.map(r => `${r.name} (${r.startingAgents}→${r.startingAgents - r.eliminate})`));
  }

  async initialize() {
    this.ui.showStatus('Initializing agents...');
    if (this.uploadedAgents) {
      await this.agentManager.initializeWithUploadedAgents(this.uploadedAgents);
    } else {
      await this.agentManager.initialize();
    }
    
    this.ui.showStatus('Loading challenges...');
    await this.challengeManager.initialize();
    
    this.gameState.activeAgents = this.agentManager.getAllAgents();
    this.gameState.startTime = moment();
    
    this.ui.showGameState(this.gameState);
    const agentCount = this.gameState.activeAgents.length;
    this.logger.log(`Game initialized with ${agentCount} agents`);
  }

  async startCompetition() {
    this.ui.showBanner('🏁 SOUL VS SOUL COMPETITION BEGINS! 🏁');
    
    for (let roundIndex = 0; roundIndex < this.roundStructure.length; roundIndex++) {
      const roundInfo = this.roundStructure[roundIndex];
      this.gameState.round = roundIndex + 1;
      
      await this.runRound(roundInfo);
      
      if (this.gameState.activeAgents.length === 1) {
        this.gameState.winner = this.gameState.activeAgents[0];
        break;
      }
      
      if (roundIndex < this.roundStructure.length - 1) {
        await this.interRoundBreak();
      }
    }
    
    await this.concludeGame();
  }

  async runRound(roundInfo) {
    this.ui.showRoundStart(roundInfo, this.gameState.activeAgents);
    
    // Select random challenge for this round
    const challenge = this.challengeManager.getRandomChallenge();
    this.ui.showChallenge(challenge);
    
    this.logger.log(`Round ${this.gameState.round}: ${challenge.name} challenge`);
    
    // Run the challenge
    const results = await this.challengeManager.runChallenge(
      challenge, 
      this.gameState.activeAgents,
      this.agentManager
    );
    
    // Show results
    this.ui.showResults(results);
    this.logger.log(`Round ${this.gameState.round} results`, results);
    
    // Eliminate lowest scorers
    const eliminated = this.eliminateAgents(results, roundInfo.eliminate);
    
    this.ui.showEliminations(eliminated);
    this.gameState.gameLog.push({
      round: this.gameState.round,
      challenge: challenge.name,
      results,
      eliminated: eliminated.map(a => a.name)
    });
  }

  eliminateAgents(results, eliminateCount) {
    // Sort by score (lowest first)
    const sortedResults = [...results].sort((a, b) => a.score - b.score);
    const toEliminate = sortedResults.slice(0, eliminateCount);
    
    // Remove from active agents
    toEliminate.forEach(result => {
      const agentIndex = this.gameState.activeAgents.findIndex(a => a.id === result.agent.id);
      if (agentIndex > -1) {
        const eliminated = this.gameState.activeAgents.splice(agentIndex, 1)[0];
        this.gameState.eliminatedAgents.push({
          ...eliminated,
          eliminatedRound: this.gameState.round,
          finalScore: result.score
        });
      }
    });
    
    return toEliminate.map(r => r.agent);
  }

  async interRoundBreak() {
    this.ui.showInterRound(this.gameState.activeAgents);
    
    // Let agents trash talk or form alliances
    const interactions = await this.runInterRoundInteractions();
    if (interactions.length > 0) {
      this.ui.showInteractions(interactions);
    }
    
    // Pause for dramatic effect
    await this.sleep(2000);
  }

  async runInterRoundInteractions() {
    const interactions = [];
    
    // 75% chance each agent says something — more trash talk = more entertainment
    for (const agent of this.gameState.activeAgents) {
      if (Math.random() < 0.75) {
        try {
          const message = await this.agentManager.getTrashTalk(agent, this.gameState);
          if (message && message.trim()) {
            interactions.push({
              agent: agent.name,
              message: message,
              type: 'trash_talk'
            });
          }
        } catch (error) {
          this.logger.logError(`Failed to get trash talk from ${agent.name}`, error);
        }
      }
    }
    
    return interactions;
  }

  async concludeGame() {
    this.ui.showWinner(this.gameState.winner);
    
    // Generate final stats
    const stats = this.generateFinalStats();
    this.ui.showFinalStats(stats);
    
    // Save game log
    await this.saveGameLog();
    
    this.logger.log('Game concluded', { 
      winner: this.gameState.winner.name,
      duration: moment().diff(this.gameState.startTime, 'minutes')
    });
  }

  generateFinalStats() {
    const duration = moment().diff(this.gameState.startTime);
    
    return {
      winner: this.gameState.winner,
      duration: moment.duration(duration).humanize(),
      totalRounds: this.gameState.round,
      challengesCompleted: this.gameState.gameLog.length,
      eliminationOrder: this.gameState.eliminatedAgents
        .sort((a, b) => b.eliminatedRound - a.eliminatedRound)
        .map((a, i) => ({ position: i + 2, ...a }))
    };
  }

  async saveGameLog() {
    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const logFile = `soul-vs-soul-${timestamp}.json`;
    
    const gameData = {
      ...this.gameState,
      finalStats: this.generateFinalStats(),
      savedAt: moment().toISOString()
    };
    
    try {
      const fs = require('fs');
      fs.writeFileSync(logFile, JSON.stringify(gameData, null, 2));
      console.log(chalk.green(`📁 Game log saved: ${logFile}`));
    } catch (error) {
      this.logger.logError('Failed to save game log', error);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GameEngine;