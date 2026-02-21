#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const figlet = require('figlet');
const moment = require('moment');
require('dotenv').config();

const GameEngine = require('./src/GameEngine');
const Logger = require('./src/Logger');

// Banner
console.clear();
console.log(chalk.red.bold(figlet.textSync('BEAST GAMES', { 
  font: 'Big',
  horizontalLayout: 'default',
  verticalLayout: 'default'
})));
console.log(chalk.yellow.bold('🎮 AI AGENTS ELIMINATION COMPETITION 🎮\n'));

async function main() {
  const logger = new Logger();
  const gameEngine = new GameEngine(logger);

  try {
    console.log(chalk.blue('🚀 Initializing Beast Games...'));
    
    // Check for API keys
    const hasOpenAI = process.env.OPENAI_API_KEY;
    const hasAnthropic = process.env.ANTHROPIC_API_KEY;
    
    if (!hasOpenAI && !hasAnthropic) {
      console.log(chalk.red('❌ No AI API keys found!'));
      console.log(chalk.yellow('Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in your .env file'));
      process.exit(1);
    }

    console.log(chalk.green(`✅ Found ${hasOpenAI ? 'OpenAI' : 'Anthropic'} API key`));
    
    // Initialize game
    await gameEngine.initialize();
    
    // Start the competition
    await gameEngine.startCompetition();
    
  } catch (error) {
    logger.logError('Game crashed!', error);
    console.log(chalk.red.bold('💥 GAME CRASHED! Check logs for details.'));
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n🛑 Game interrupted. Goodbye!'));
  process.exit(0);
});

main().catch(console.error);