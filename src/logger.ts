import pino from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.apiKey', '*.password'],
  ...(config.NODE_ENV !== 'production' && {
    transport: { target: 'pino/file', options: { destination: 1 } },
  }),
});
