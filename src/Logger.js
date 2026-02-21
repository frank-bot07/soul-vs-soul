const fs = require('fs');
const path = require('path');
const moment = require('moment');

class Logger {
  constructor() {
    this.logFile = path.join(process.cwd(), `soul-vs-soul-${moment().format('YYYY-MM-DD_HH-mm-ss')}.log`);
    this.ensureLogFile();
  }

  ensureLogFile() {
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, `Soul vs Soul Log - Started ${moment().toISOString()}\n${'='.repeat(60)}\n\n`);
    }
  }

  log(message, data = null) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logEntry = `[${timestamp}] ${message}${data ? `\n${JSON.stringify(data, null, 2)}` : ''}\n\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  logError(message, error) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logEntry = `[${timestamp}] ERROR: ${message}\n${error.stack || error.message || error}\n\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (logError) {
      console.error('Failed to write error to log file:', logError);
    }
  }

  logAgentResponse(agent, challenge, response, score) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const logEntry = `[${timestamp}] AGENT RESPONSE
Agent: ${agent.name} (${agent.id})
Challenge: ${challenge}
Score: ${score}
Response: ${response}
${'─'.repeat(40)}

`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to log agent response:', error);
    }
  }

  logRoundResults(round, challenge, results) {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    let logEntry = `[${timestamp}] ROUND ${round} RESULTS
Challenge: ${challenge}
${'─'.repeat(40)}
`;

    results.forEach((result, i) => {
      logEntry += `${i + 1}. ${result.agent.name}: ${result.score} points\n`;
    });

    logEntry += `${'─'.repeat(40)}\n\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to log round results:', error);
    }
  }

  getLogFilePath() {
    return this.logFile;
  }
}

module.exports = Logger;