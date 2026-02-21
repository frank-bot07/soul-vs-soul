const chalk = require('chalk');
const moment = require('moment');

class UI {
  constructor() {
    this.colorMap = {
      blue: chalk.blue,
      yellow: chalk.yellow,
      red: chalk.red,
      green: chalk.green,
      purple: chalk.magenta,
      magenta: chalk.magenta,
      cyan: chalk.cyan,
      white: chalk.white,
      gray: chalk.gray
    };
    this.width = process.stdout.columns || 80;
  }

  showStatus(message) {
    console.log(chalk.blue(`\n🔄 ${message}`));
  }

  showBanner(text) {
    const border = '═'.repeat(this.width - 4);
    console.log(chalk.red.bold(`\n╔${border}╗`));
    console.log(chalk.red.bold(`║ ${text.padEnd(this.width - 6)} ║`));
    console.log(chalk.red.bold(`╚${border}╝\n`));
  }

  showGameState(gameState) {
    console.log(chalk.cyan('\n📊 GAME STATE'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`🕐 Started: ${moment(gameState.startTime).format('HH:mm:ss')}`);
    console.log(`🤖 Active Agents: ${gameState.activeAgents.length}`);
    console.log(`💀 Eliminated: ${gameState.eliminatedAgents.length}`);
    console.log(`🎯 Current Round: ${gameState.round || 'Not started'}`);
    
    if (gameState.activeAgents.length > 0) {
      console.log(chalk.yellow('\n🏆 REMAINING COMPETITORS:'));
      gameState.activeAgents.forEach((agent, i) => {
        const colorFunc = this.colorMap[agent.color] || chalk.white;
        console.log(`  ${i + 1}. ${agent.emoji} ${colorFunc(agent.name)} - "${agent.personality}"`);
      });
    }
  }

  showRoundStart(roundInfo, activeAgents) {
    this.showBanner(`🎪 ${roundInfo.name.toUpperCase()} BEGINS! 🎪`);
    
    console.log(chalk.yellow(`👥 ${activeAgents.length} agents compete`));
    console.log(chalk.red(`💀 ${roundInfo.eliminate} will be eliminated\n`));
    
    console.log(chalk.cyan('🤖 COMPETITORS:'));
    activeAgents.forEach((agent, i) => {
      const colorFunc = this.colorMap[agent.color] || chalk.white;
      console.log(`  ${i + 1}. ${agent.emoji} ${colorFunc(agent.name)}`);
    });
  }

  showChallenge(challenge) {
    console.log(chalk.magenta(`\n🎯 CHALLENGE: ${challenge.name.toUpperCase()}`));
    console.log(chalk.gray(`📝 ${challenge.description}`));
    console.log(chalk.gray(`📊 Scoring: ${challenge.scoreMethod.replace('_', ' ')}`));
    console.log(chalk.yellow('\n🚀 Challenge starting...\n'));
  }

  showResults(results) {
    console.log(chalk.green('\n🏆 CHALLENGE RESULTS'));
    console.log(chalk.gray('═'.repeat(60)));
    
    results.forEach((result, i) => {
      const position = i + 1;
      const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
      const scoreBar = this.createScoreBar(result.score);
      
      const colorFunc = this.colorMap[result.agent.color] || chalk.white;
      console.log(`${medal} ${result.agent.emoji} ${colorFunc(result.agent.name.padEnd(15))} ${chalk.cyan(result.score.toString().padStart(3))} ${scoreBar}`);
      
      if (result.response) {
        console.log(chalk.gray(`   📝 "${result.response}"`));
      }
      
      if (i < results.length - 1) {
        console.log('');
      }
    });
  }

  createScoreBar(score) {
    const maxBarLength = 20;
    const filledLength = Math.round((score / 100) * maxBarLength);
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(maxBarLength - filledLength);
    
    if (score >= 80) return chalk.green(`[${filled}${empty}]`);
    if (score >= 60) return chalk.yellow(`[${filled}${empty}]`);
    return chalk.red(`[${filled}${empty}]`);
  }

  showEliminations(eliminated) {
    if (eliminated.length === 0) return;
    
    console.log(chalk.red('\n💀 ELIMINATIONS'));
    console.log(chalk.gray('─'.repeat(40)));
    
    eliminated.forEach(agent => {
      console.log(chalk.red(`💔 ${agent.emoji} ${agent.name} has been ELIMINATED!`));
      console.log(chalk.gray(`   "${agent.personality}"`));
    });
    
    if (eliminated.length === 1) {
      console.log(chalk.red.bold('\n🪦 One agent down...'));
    } else {
      console.log(chalk.red.bold(`\n🪦 ${eliminated.length} agents down...`));
    }
  }

  showInterRound(remainingAgents) {
    console.log(chalk.blue('\n⏸️  INTER-ROUND BREAK'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(chalk.cyan(`🏃 ${remainingAgents.length} agents advance to the next round`));
    console.log(chalk.yellow('💬 Agents may trash talk or form alliances...\n'));
  }

  showInteractions(interactions) {
    interactions.forEach(interaction => {
      const agent = interaction.agent;
      console.log(chalk.yellow(`💬 ${agent}: "${interaction.message}"`));
    });
    console.log('');
  }

  showWinner(winner) {
    this.showBanner('🎉 WE HAVE A WINNER! 🎉');
    
    console.log(chalk.yellow('\n👑 SOUL VS SOUL CHAMPION:'));
    console.log(chalk.yellow(`   ${winner.emoji} ${winner.name.toUpperCase()}`));
    console.log(chalk.gray(`   "${winner.personality}"`));
    
    console.log(chalk.green('\n🎊 Congratulations! You survived all eliminations and claimed victory!'));
    
    // Victory animation
    const crowns = ['👑', '🏆', '🥇', '⭐', '🌟'];
    let animFrame = 0;
    
    const animate = () => {
      if (animFrame < 10) {
        process.stdout.write(`\r${chalk.yellow(crowns[animFrame % crowns.length])} ${chalk.yellow.bold('CHAMPION')} ${chalk.yellow(crowns[(animFrame + 1) % crowns.length])}`);
        animFrame++;
        setTimeout(animate, 200);
      } else {
        process.stdout.write('\n\n');
      }
    };
    
    animate();
  }

  showFinalStats(stats) {
    setTimeout(() => {
      console.log(chalk.cyan('\n📊 FINAL COMPETITION STATISTICS'));
      console.log(chalk.gray('═'.repeat(50)));
      
      console.log(`🕐 Total Duration: ${stats.duration}`);
      console.log(`🎯 Rounds Completed: ${stats.totalRounds}`);
      console.log(`🏆 Challenges Completed: ${stats.challengesCompleted}`);
      
      console.log(chalk.yellow('\n🏁 FINAL STANDINGS:'));
      console.log(chalk.green(`   1st: ${stats.winner.emoji} ${stats.winner.name} - WINNER! 🥇`));
      
      stats.eliminationOrder.forEach(agent => {
        const position = agent.position;
        const suffix = position === 2 ? 'nd' : position === 3 ? 'rd' : 'th';
        console.log(`   ${position}${suffix}: ${agent.emoji} ${agent.name} - Eliminated Round ${agent.eliminatedRound}`);
      });
      
      console.log(chalk.magenta('\n🎭 AGENT PERSONALITIES RECAP:'));
      const allAgents = [stats.winner, ...stats.eliminationOrder];
      allAgents.forEach(agent => {
        console.log(`   ${agent.emoji} ${agent.name}: "${agent.personality}"`);
      });
      
      console.log(chalk.blue.bold('\n🎮 Thanks for watching Soul vs Soul! 🎮'));
    }, 2000);
  }

  showError(message, error) {
    console.log(chalk.red(`\n❌ ERROR: ${message}`));
    if (error && error.message) {
      console.log(chalk.gray(`   ${error.message}`));
    }
  }
}

module.exports = UI;