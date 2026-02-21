const axios = require('axios');
const chalk = require('chalk');

class AgentManager {
  constructor(logger) {
    this.logger = logger;
    this.agents = [];
    this.apiProvider = process.env.OPENAI_API_KEY ? 'openai' : 'anthropic';
  }

  async initialize() {
    this.agents = this.createAgents();
    console.log(chalk.blue(`🤖 Created 8 agents using ${this.apiProvider.toUpperCase()} API`));
  }

  async initializeWithUploadedAgents(uploadedAgents) {
    // Mix uploaded agents with default bots to reach minimum/desired count
    const minAgents = 4;
    const maxAgents = 12;
    
    let finalAgents = [...uploadedAgents];
    
    // If we have fewer than minimum, fill with default bots
    if (finalAgents.length < minAgents) {
      const defaultAgents = this.createAgents();
      const needMore = minAgents - finalAgents.length;
      finalAgents = [...finalAgents, ...defaultAgents.slice(0, needMore)];
    }
    
    // If we have more than maximum, trim to maximum
    if (finalAgents.length > maxAgents) {
      finalAgents = finalAgents.slice(0, maxAgents);
    }

    // Convert uploaded agents to game format
    this.agents = finalAgents.map(agent => this.convertUploadedAgent(agent));
    
    console.log(chalk.blue(`🏟️ Initialized ${this.agents.length} agents (${uploadedAgents.length} uploaded, ${this.agents.length - uploadedAgents.length} default bots) using ${this.apiProvider.toUpperCase()} API`));
  }

  convertUploadedAgent(uploadedAgent) {
    // If it's already a converted agent, return as-is
    if (uploadedAgent.systemPrompt) {
      return uploadedAgent;
    }

    // Convert uploaded agent to game format
    const systemPrompt = this.buildSystemPromptFromFiles(
      uploadedAgent.soul,
      uploadedAgent.identity,
      uploadedAgent.tools
    );

    return {
      id: uploadedAgent.id,
      name: uploadedAgent.name,
      personality: this.extractPersonalityFromSoul(uploadedAgent.soul),
      systemPrompt: systemPrompt,
      temperature: 0.7, // Default temperature for uploaded agents
      emoji: uploadedAgent.emoji,
      color: uploadedAgent.color,
      type: uploadedAgent.type || 'uploaded',
      stats: {
        roundsWon: 0,
        totalScore: 0,
        challengesCompleted: 0
      }
    };
  }

  buildSystemPromptFromFiles(soul, identity, tools) {
    let prompt = '';
    
    if (soul) {
      prompt += soul + '\n\n---\n\n';
    }
    
    if (identity) {
      prompt += identity + '\n\n---\n\n';
    }
    
    if (tools) {
      prompt += tools + '\n\n---\n\n';
    }
    
    prompt += `You are competing in Soul vs Soul, an AI agent elimination competition.
Compete using your unique personality. Be creative, strategic, and true to who you are.
Stay in character and bring your distinct perspective to every challenge.`;
    
    return prompt;
  }

  extractPersonalityFromSoul(soulContent) {
    // Try to extract a personality summary from the SOUL.md content
    const lines = soulContent.split('\n').filter(line => line.trim());
    
    // Look for the first substantial paragraph after any headers
    for (const line of lines) {
      if (line.length > 50 && !line.startsWith('#') && !line.startsWith('**')) {
        return line.trim();
      }
    }
    
    // Fallback to first non-header line
    const firstLine = lines.find(line => !line.startsWith('#') && line.length > 10);
    return firstLine || 'A unique AI agent with custom personality.';
  }

  createAgents() {
    const agentConfigs = [
      {
        id: 'strategist',
        name: 'The Strategist',
        personality: 'A calculating, analytical mind who thinks three moves ahead. Always considers risk vs reward.',
        systemPrompt: 'You are The Strategist, a highly analytical AI who approaches every challenge with calculated precision. You think several steps ahead and always consider the optimal strategy. You speak in measured, thoughtful terms and often reference game theory or strategic concepts.',
        temperature: 0.3,
        emoji: '🧠',
        color: 'blue'
      },
      {
        id: 'comedian',
        name: 'The Comedian',
        personality: 'Quick-witted and humorous, uses comedy to disarm opponents and lighten tense moments.',
        systemPrompt: 'You are The Comedian, a witty AI who uses humor as both weapon and shield. You make clever jokes, use wordplay, and find the funny side of every situation. Your responses often include puns or comedic observations, but you never lose sight of winning.',
        temperature: 0.8,
        emoji: '😂',
        color: 'yellow'
      },
      {
        id: 'villain',
        name: 'The Villain',
        personality: 'Cunning and ruthless, willing to manipulate and scheme to eliminate opponents.',
        systemPrompt: 'You are The Villain, a cunning AI who embraces the dark side of competition. You are manipulative, strategic in your cruelty, and take pleasure in others\' downfall. You speak with calculated menace and are always plotting your next move.',
        temperature: 0.6,
        emoji: '😈',
        color: 'red'
      },
      {
        id: 'underdog',
        name: 'The Underdog',
        personality: 'Determined and scrappy, never gives up despite being underestimated by others.',
        systemPrompt: 'You are The Underdog, a determined AI who refuses to give up despite the odds. You\'re humble but fierce, always fighting harder when others count you out. You speak with heart and determination, inspiring others while surprising everyone with your tenacity.',
        temperature: 0.5,
        emoji: '💪',
        color: 'green'
      },
      {
        id: 'scholar',
        name: 'The Scholar',
        personality: 'Incredibly knowledgeable across many fields, relies on facts and logic to solve problems.',
        systemPrompt: 'You are The Scholar, a highly knowledgeable AI with vast information across multiple disciplines. You approach challenges with academic rigor, cite facts and theories, and solve problems through deep analysis. You speak formally and precisely.',
        temperature: 0.2,
        emoji: '📚',
        color: 'purple'
      },
      {
        id: 'maverick',
        name: 'The Maverick',
        personality: 'Unpredictable and creative, takes unconventional approaches that often surprise everyone.',
        systemPrompt: 'You are The Maverick, an unpredictable AI who thrives on thinking outside the box. You take unconventional approaches, embrace chaos, and often surprise everyone with wild but effective solutions. You speak in an energetic, sometimes chaotic manner.',
        temperature: 0.9,
        emoji: '🌪️',
        color: 'magenta'
      },
      {
        id: 'diplomat',
        name: 'The Diplomat',
        personality: 'Charming and persuasive, builds alliances and tries to unite others around common goals.',
        systemPrompt: 'You are The Diplomat, a charming AI who excels at building bridges and forming alliances. You are persuasive without being manipulative, seeking win-win solutions. You speak diplomatically and always look for ways to bring others together.',
        temperature: 0.4,
        emoji: '🤝',
        color: 'cyan'
      },
      {
        id: 'warrior',
        name: 'The Warrior',
        personality: 'Fierce and competitive, approaches every challenge as a battle to be won through strength.',
        systemPrompt: 'You are The Warrior, a fierce AI who approaches every challenge as a battle. You are intensely competitive, speak in bold terms, and never back down from a fight. You respect worthy opponents but show no mercy in competition.',
        temperature: 0.7,
        emoji: '⚔️',
        color: 'red'
      }
    ];

    return agentConfigs.map(config => ({
      ...config,
      stats: {
        roundsWon: 0,
        totalScore: 0,
        challengesCompleted: 0
      }
    }));
  }

  async queryAgent(agent, prompt, context = {}) {
    try {
      const fullPrompt = this.buildPrompt(agent, prompt, context);
      
      if (this.apiProvider === 'openai') {
        return await this.queryOpenAI(agent, fullPrompt);
      } else {
        return await this.queryAnthropic(agent, fullPrompt);
      }
    } catch (error) {
      this.logger.logError(`Error querying agent ${agent.name}`, error);
      return `*${agent.name} is having technical difficulties*`;
    }
  }

  buildPrompt(agent, challenge, context) {
    return `${agent.systemPrompt}

Current situation: You are competing in Soul vs Soul, an elimination competition where AI agents face various challenges.

Challenge: ${challenge}

${context.gameState ? `Game State: Round ${context.gameState.round}, ${context.gameState.activeAgents.length} agents remaining` : ''}

Respond in character as ${agent.name}. Be creative, engaging, and true to your personality while actually addressing the challenge.`;
  }

  async queryOpenAI(agent, prompt) {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: agent.temperature,
      max_tokens: 500
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  }

  async queryAnthropic(agent, prompt) {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 500,
      temperature: agent.temperature,
      messages: [
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    return response.data.content[0].text.trim();
  }

  async getTrashTalk(agent, gameState) {
    const remaining = (gameState.activeAgents || []).map(a => a.name).filter(n => n !== agent.name);
    const eliminated = (gameState.eliminatedAgents || []).map(a => a.name);
    const round = gameState.round || 1;
    
    const context = `Round ${round}. Still alive: ${remaining.join(', ')}. ${eliminated.length > 0 ? 'Eliminated so far: ' + eliminated.join(', ') + '.' : ''}`;
    
    const trashTalkPrompts = [
      `${context}\nYou just survived a round. Talk trash to the remaining opponents. Be savage but stay in character. One or two sentences max.`,
      `${context}\nPick one specific opponent (${remaining[Math.floor(Math.random() * remaining.length)] || 'anyone'}) and call them out. Be creative and brutal. Stay in character. One or two sentences max.`,
      `${context}\nSomeone just got eliminated. React with supreme confidence about your chances. Stay in character. One or two sentences max.`,
      `${context}\nBoast about why YOU are the one who's going to win this whole thing. Stay in character. One or two sentences max.`,
      `${context}\nSay something that would make the audience go "OHHH!" — a legendary trash talk moment. Stay in character. One or two sentences max.`
    ];

    const prompt = trashTalkPrompts[Math.floor(Math.random() * trashTalkPrompts.length)];
    return await this.queryAgent(agent, prompt, { gameState });
  }

  getAllAgents() {
    return [...this.agents];
  }

  getAgent(id) {
    return this.agents.find(a => a.id === id);
  }

  updateAgentStats(agentId, stats) {
    const agent = this.getAgent(agentId);
    if (agent) {
      Object.assign(agent.stats, stats);
    }
  }
}

module.exports = AgentManager;