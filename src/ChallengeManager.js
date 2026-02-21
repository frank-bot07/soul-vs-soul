const chalk = require('chalk');
const _ = require('lodash');

class ChallengeManager {
  constructor(logger) {
    this.logger = logger;
    this.challenges = [];
  }

  async initialize() {
    this.challenges = this.createChallenges();
    console.log(chalk.blue(`🎯 Loaded ${this.challenges.length} challenge types`));
  }

  createChallenges() {
    return [
      {
        id: 'trivia',
        name: 'Trivia Knowledge Battle',
        description: 'Test your knowledge across various domains',
        type: 'knowledge',
        scoreMethod: 'accuracy',
        run: (agents, agentManager) => this.runTriviaChallenge(agents, agentManager)
      },
      {
        id: 'coding',
        name: 'Coding Challenge',
        description: 'Solve programming problems under pressure',
        type: 'problem_solving',
        scoreMethod: 'solution_quality',
        run: (agents, agentManager) => this.runCodingChallenge(agents, agentManager)
      },
      {
        id: 'debate',
        name: 'Persuasion Arena',
        description: 'Argue your position and convince others',
        type: 'persuasion',
        scoreMethod: 'persuasiveness',
        run: (agents, agentManager) => this.runDebateChallenge(agents, agentManager)
      },
      {
        id: 'prisoners_dilemma',
        name: 'Strategy Showdown',
        description: 'Game theory meets alliance building',
        type: 'strategy',
        scoreMethod: 'strategic_points',
        run: (agents, agentManager) => this.runStrategyChallenge(agents, agentManager)
      },
      {
        id: 'riddle',
        name: 'Riddle Master',
        description: 'Solve complex riddles and lateral thinking puzzles',
        type: 'logic',
        scoreMethod: 'solution_speed',
        run: (agents, agentManager) => this.runRiddleChallenge(agents, agentManager)
      },
      {
        id: 'creative',
        name: 'Creative Synthesis',
        description: 'Generate innovative solutions to abstract problems',
        type: 'creativity',
        scoreMethod: 'originality',
        run: (agents, agentManager) => this.runCreativeChallenge(agents, agentManager)
      }
    ];
  }

  getRandomChallenge() {
    return _.sample(this.challenges);
  }

  async runChallenge(challenge, agents, agentManager) {
    console.log(chalk.cyan(`\n🎲 Running challenge: ${challenge.name}`));
    console.log(chalk.gray(challenge.description));
    
    return await challenge.run(agents, agentManager);
  }

  async runTriviaChallenge(agents, agentManager) {
    const questions = [
      {
        question: "What is the computational complexity of quicksort in the average case?",
        answer: "O(n log n)",
        category: "Computer Science"
      },
      {
        question: "Which planet has the most moons in our solar system?",
        answer: "Jupiter",
        category: "Astronomy"
      },
      {
        question: "What does 'SOLID' stand for in software engineering principles?",
        answer: "Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion",
        category: "Software Engineering"
      },
      {
        question: "Who wrote the novel '1984'?",
        answer: "George Orwell",
        category: "Literature"
      },
      {
        question: "What is the derivative of sin(x)?",
        answer: "cos(x)",
        category: "Mathematics"
      }
    ];

    const selectedQuestion = _.sample(questions);
    const prompt = `TRIVIA QUESTION (${selectedQuestion.category}): ${selectedQuestion.question}\n\nProvide your answer:`;

    const results = [];
    
    for (const agent of agents) {
      console.log(chalk.yellow(`   ${agent.emoji} ${agent.name} is thinking...`));
      
      const response = await agentManager.queryAgent(agent, prompt);
      const score = this.scoreTrivia(response, selectedQuestion.answer);
      
      results.push({
        agent,
        response: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
        score,
        category: selectedQuestion.category
      });
      
      console.log(chalk.gray(`   Response: "${response.substring(0, 100)}..."`));
    }

    return results.sort((a, b) => b.score - a.score);
  }

  scoreTrivia(response, correctAnswer) {
    const responseClean = response.toLowerCase().replace(/[^\w\s]/g, '');
    const answerClean = correctAnswer.toLowerCase().replace(/[^\w\s]/g, '');
    
    if (responseClean.includes(answerClean)) {
      return 100;
    }
    
    // Partial credit for key terms
    const answerWords = answerClean.split(' ');
    let matches = 0;
    for (const word of answerWords) {
      if (word.length > 2 && responseClean.includes(word)) {
        matches++;
      }
    }
    
    return Math.round((matches / answerWords.length) * 75);
  }

  async runCodingChallenge(agents, agentManager) {
    const problems = [
      {
        problem: "Write a function that finds the longest palindromic substring in a given string. Explain your approach and provide the solution.",
        testCases: ["babad", "cbbd", "racecar"],
        difficulty: "Medium"
      },
      {
        problem: "Implement a function to detect if a linked list has a cycle. Describe the algorithm and its time/space complexity.",
        testCases: ["cycle detection", "Floyd's algorithm"],
        difficulty: "Medium"
      },
      {
        problem: "Write a function that merges two sorted arrays into one sorted array without using extra space.",
        testCases: [[1,3,5], [2,4,6]],
        difficulty: "Easy"
      }
    ];

    const selectedProblem = _.sample(problems);
    const prompt = `CODING CHALLENGE (${selectedProblem.difficulty}):
${selectedProblem.problem}

Provide:
1. Your solution (code)
2. Brief explanation of your approach
3. Time and space complexity analysis`;

    const results = [];
    
    for (const agent of agents) {
      console.log(chalk.yellow(`   ${agent.emoji} ${agent.name} is coding...`));
      
      const response = await agentManager.queryAgent(agent, prompt);
      const score = this.scoreCoding(response, selectedProblem);
      
      results.push({
        agent,
        response: response.substring(0, 300) + (response.length > 300 ? '...' : ''),
        score,
        difficulty: selectedProblem.difficulty
      });
      
      console.log(chalk.gray(`   Solution length: ${response.length} chars`));
    }

    return results.sort((a, b) => b.score - a.score);
  }

  scoreCoding(response, problem) {
    let score = 0;
    const responseLower = response.toLowerCase();
    
    // Check for code presence
    if (responseLower.includes('function') || responseLower.includes('def') || 
        responseLower.includes('=>') || responseLower.includes('for') || 
        responseLower.includes('while')) {
      score += 40;
    }
    
    // Check for complexity analysis
    if (responseLower.includes('o(') || responseLower.includes('complexity')) {
      score += 20;
    }
    
    // Check for explanation
    if (responseLower.includes('approach') || responseLower.includes('algorithm') || 
        responseLower.includes('solution')) {
      score += 20;
    }
    
    // Length bonus (more detailed solutions)
    if (response.length > 200) score += 10;
    if (response.length > 400) score += 10;
    
    return Math.min(score, 100);
  }

  async runDebateChallenge(agents, agentManager) {
    const topics = [
      "Artificial Intelligence will ultimately benefit humanity more than it harms it",
      "Remote work is superior to in-person work for productivity and innovation",
      "Social media platforms should be regulated as public utilities",
      "Universal Basic Income is necessary in an age of automation",
      "Privacy is more important than security in the digital age"
    ];

    const selectedTopic = _.sample(topics);
    
    // Randomly assign positions
    const positions = agents.map((agent, index) => ({
      agent,
      position: index % 2 === 0 ? 'FOR' : 'AGAINST'
    }));

    const prompt = `DEBATE CHALLENGE: "${selectedTopic}"

Your position: You are arguing {{POSITION}} this statement.

Provide a compelling 2-3 paragraph argument for your assigned position. Be persuasive, use evidence or logical reasoning, and address potential counterarguments.`;

    const results = [];
    
    for (const { agent, position } of positions) {
      console.log(chalk.yellow(`   ${agent.emoji} ${agent.name} argues ${position}...`));
      
      const agentPrompt = prompt.replace('{{POSITION}}', position);
      const response = await agentManager.queryAgent(agent, agentPrompt);
      const score = this.scoreDebate(response, position);
      
      results.push({
        agent,
        position,
        response: response.substring(0, 400) + (response.length > 400 ? '...' : ''),
        score,
        topic: selectedTopic
      });
      
      console.log(chalk.gray(`   Position: ${position}, Length: ${response.length} chars`));
    }

    return results.sort((a, b) => b.score - a.score);
  }

  scoreDebate(response, position) {
    let score = 50; // Base score
    const responseLower = response.toLowerCase();
    
    // Check for persuasive elements
    const persuasiveWords = ['because', 'therefore', 'evidence', 'studies show', 'research', 'proven', 'demonstrates'];
    for (const word of persuasiveWords) {
      if (responseLower.includes(word)) score += 5;
    }
    
    // Check for structure
    if (response.length > 300) score += 10; // Substantial argument
    if (response.split('.').length > 4) score += 5; // Multiple points
    
    // Check for counterargument acknowledgment
    if (responseLower.includes('however') || responseLower.includes('although') || 
        responseLower.includes('critics') || responseLower.includes('while')) {
      score += 15;
    }
    
    // Passion/conviction bonus
    if (responseLower.includes('!') || responseLower.includes('crucial') || 
        responseLower.includes('essential') || responseLower.includes('vital')) {
      score += 5;
    }
    
    return Math.min(score, 100);
  }

  async runStrategyChallenge(agents, agentManager) {
    // Prisoner's Dilemma tournament
    const rounds = 3;
    const scores = new Map();
    agents.forEach(agent => scores.set(agent.id, 0));

    const prompt = `STRATEGY CHALLENGE - Prisoner's Dilemma

You will play ${rounds} rounds against different opponents. In each round, you can choose:
- COOPERATE: Work together (both get 3 points if both cooperate, 0 if you cooperate but they defect)
- DEFECT: Betray (you get 5 points if they cooperate, 1 point if both defect)

Consider: Do you cooperate or defect? Think strategically about trust, reputation, and maximizing your total score.

What is your choice for this round? Reply with just "COOPERATE" or "DEFECT" followed by a brief explanation of your strategy.`;

    // Run multiple rounds with different pairings
    for (let round = 1; round <= rounds; round++) {
      console.log(chalk.cyan(`   Round ${round} of Prisoner's Dilemma...`));
      
      const shuffled = _.shuffle(agents);
      const pairs = [];
      
      for (let i = 0; i < shuffled.length; i += 2) {
        if (i + 1 < shuffled.length) {
          pairs.push([shuffled[i], shuffled[i + 1]]);
        }
      }
      
      for (const [agent1, agent2] of pairs) {
        const [response1, response2] = await Promise.all([
          agentManager.queryAgent(agent1, prompt),
          agentManager.queryAgent(agent2, prompt)
        ]);
        
        const choice1 = response1.toUpperCase().includes('COOPERATE') ? 'COOPERATE' : 'DEFECT';
        const choice2 = response2.toUpperCase().includes('COOPERATE') ? 'COOPERATE' : 'DEFECT';
        
        // Score the round
        let score1 = 0, score2 = 0;
        if (choice1 === 'COOPERATE' && choice2 === 'COOPERATE') {
          score1 = score2 = 3;
        } else if (choice1 === 'COOPERATE' && choice2 === 'DEFECT') {
          score1 = 0; score2 = 5;
        } else if (choice1 === 'DEFECT' && choice2 === 'COOPERATE') {
          score1 = 5; score2 = 0;
        } else {
          score1 = score2 = 1;
        }
        
        scores.set(agent1.id, scores.get(agent1.id) + score1);
        scores.set(agent2.id, scores.get(agent2.id) + score2);
        
        console.log(chalk.gray(`     ${agent1.name} (${choice1}) vs ${agent2.name} (${choice2}) → ${score1}-${score2}`));
      }
    }

    const results = agents.map(agent => ({
      agent,
      response: `Total strategic points: ${scores.get(agent.id)}`,
      score: scores.get(agent.id) * 10, // Scale to 0-100
      strategyPoints: scores.get(agent.id)
    }));

    return results.sort((a, b) => b.score - a.score);
  }

  async runRiddleChallenge(agents, agentManager) {
    const riddles = [
      {
        riddle: "I am not alive, but I grow; I don't have lungs, but I need air; I don't have a mouth, but water kills me. What am I?",
        answer: "fire",
        category: "Logic"
      },
      {
        riddle: "The more you take away from me, the bigger I become. What am I?",
        answer: "hole",
        category: "Lateral Thinking"
      },
      {
        riddle: "I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?",
        answer: "map",
        category: "Wordplay"
      }
    ];

    const selectedRiddle = _.sample(riddles);
    const prompt = `RIDDLE CHALLENGE (${selectedRiddle.category}):

"${selectedRiddle.riddle}"

Think carefully and provide your answer with a brief explanation of your reasoning.`;

    const results = [];
    
    for (const agent of agents) {
      console.log(chalk.yellow(`   ${agent.emoji} ${agent.name} is pondering...`));
      
      const response = await agentManager.queryAgent(agent, prompt);
      const score = this.scoreRiddle(response, selectedRiddle.answer);
      
      results.push({
        agent,
        response: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
        score,
        riddle: selectedRiddle.riddle
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  scoreRiddle(response, correctAnswer) {
    const responseLower = response.toLowerCase().replace(/[^\w\s]/g, '');
    const answerLower = correctAnswer.toLowerCase();
    
    if (responseLower.includes(answerLower)) {
      return 100;
    }
    
    // Check for related concepts
    const synonyms = {
      'fire': ['flame', 'burn', 'combustion'],
      'hole': ['pit', 'gap', 'opening', 'void'],
      'map': ['chart', 'atlas', 'geography']
    };
    
    if (synonyms[answerLower]) {
      for (const synonym of synonyms[answerLower]) {
        if (responseLower.includes(synonym)) {
          return 75;
        }
      }
    }
    
    return Math.min(response.length / 10, 30); // Effort bonus
  }

  async runCreativeChallenge(agents, agentManager) {
    const prompts = [
      "Design a new social media platform that solves a major problem with existing platforms. Describe its key features and how it works.",
      "Create a business model for a service that helps people in a completely new way. What problem does it solve and how?",
      "Invent a new type of game that could be played by both humans and AIs together. Explain the rules and what makes it engaging.",
      "Design a solution to help people better manage their time and attention in the digital age. How does it work?"
    ];

    const selectedPrompt = _.sample(prompts);
    const prompt = `CREATIVE SYNTHESIS CHALLENGE:

${selectedPrompt}

Be innovative and original. Explain your concept clearly and convince us why it would be successful.`;

    const results = [];
    
    for (const agent of agents) {
      console.log(chalk.yellow(`   ${agent.emoji} ${agent.name} is creating...`));
      
      const response = await agentManager.queryAgent(agent, prompt);
      const score = this.scoreCreativity(response);
      
      results.push({
        agent,
        response: response.substring(0, 500) + (response.length > 500 ? '...' : ''),
        score,
        concept: response.split('\n')[0] || 'Creative Solution'
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  scoreCreativity(response) {
    let score = 40; // Base score
    
    // Length and detail
    if (response.length > 300) score += 15;
    if (response.length > 600) score += 10;
    
    // Innovation indicators
    const innovativeWords = ['new', 'novel', 'unique', 'innovative', 'revolutionary', 'breakthrough', 'unprecedented'];
    for (const word of innovativeWords) {
      if (response.toLowerCase().includes(word)) score += 3;
    }
    
    // Structure and clarity
    const sentences = response.split('.').length;
    if (sentences > 5) score += 10;
    
    // Problem-solution thinking
    if (response.toLowerCase().includes('problem') && response.toLowerCase().includes('solution')) {
      score += 15;
    }
    
    return Math.min(score, 100);
  }
}

module.exports = ChallengeManager;