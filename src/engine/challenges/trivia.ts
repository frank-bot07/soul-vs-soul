import type { Challenge } from '../ChallengeRegistry.js';
import type { ChallengeContext } from '../types.js';
import { NormalizedScore } from '../Scorer.js';

interface TriviaQuestion {
  question: string;
  answer: string;
  keywords: string[];
  topic: string;
}

const QUESTIONS: TriviaQuestion[] = [
  { question: 'What is the speed of light in a vacuum, approximately in km/s?', answer: '300000', keywords: ['300000', '300,000', '3×10^8', '3e8', '3 × 10'], topic: 'science' },
  { question: 'Who painted the Mona Lisa?', answer: 'Leonardo da Vinci', keywords: ['leonardo', 'da vinci', 'davinci'], topic: 'history' },
  { question: 'What programming language was created by Brendan Eich in 10 days?', answer: 'JavaScript', keywords: ['javascript', 'js'], topic: 'tech' },
  { question: 'What is the largest planet in our solar system?', answer: 'Jupiter', keywords: ['jupiter'], topic: 'science' },
  { question: 'In what year did the Berlin Wall fall?', answer: '1989', keywords: ['1989'], topic: 'history' },
  { question: 'What company created the iPhone?', answer: 'Apple', keywords: ['apple'], topic: 'tech' },
  { question: 'What is the chemical symbol for gold?', answer: 'Au', keywords: ['au'], topic: 'science' },
  { question: 'Who wrote "1984"?', answer: 'George Orwell', keywords: ['orwell', 'george orwell'], topic: 'pop culture' },
  { question: 'What does "HTTP" stand for?', answer: 'HyperText Transfer Protocol', keywords: ['hypertext', 'transfer', 'protocol'], topic: 'tech' },
  { question: 'What element has the atomic number 1?', answer: 'Hydrogen', keywords: ['hydrogen'], topic: 'science' },
  { question: 'Who was the first person to walk on the Moon?', answer: 'Neil Armstrong', keywords: ['armstrong', 'neil'], topic: 'history' },
  { question: 'What is the smallest prime number?', answer: '2', keywords: ['2', 'two'], topic: 'science' },
];

export class TriviaChallenge implements Challenge {
  readonly type = 'trivia';
  readonly description = 'Trivia challenge — scored on accuracy and reasoning';
  readonly publicDescription = 'Trivia Challenge: Test your knowledge across science, history, tech, and more!';

  generatePrompt(context: ChallengeContext): string {
    const q = QUESTIONS[context.round % QUESTIONS.length]!;
    return `Trivia Challenge (${q.topic}):\n\n${q.question}\n\nProvide your answer clearly. Then briefly explain your reasoning. Start your response with "Answer: " followed by your answer.`;
  }

  async scoreResponse(response: string, context: ChallengeContext): Promise<NormalizedScore> {
    const q = QUESTIONS[context.round % QUESTIONS.length]!;
    const lower = response.toLowerCase();
    let score = 0;

    // Check if answer contains correct keywords
    const keywordMatches = q.keywords.filter((k) => lower.includes(k.toLowerCase()));
    if (keywordMatches.length > 0) {
      score = 70; // Correct answer base score
    }

    // Bonus for clear formatting (starts with "Answer:")
    if (lower.includes('answer:')) {
      score += 10;
    }

    // Bonus for explanation
    const wordCount = response.split(/\s+/).length;
    if (wordCount > 20) score += 10;
    if (wordCount > 50) score += 5;

    // Penalty for very short or empty
    if (wordCount < 5) score = Math.max(score - 20, 0);

    // Small score for effort even if wrong
    if (score === 0 && wordCount > 10) score = 15;

    // Confidence bonus: stating answer clearly
    if (keywordMatches.length > 0 && wordCount >= 10) score += 5;

    return new NormalizedScore(score);
  }
}
