import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use textContent or DOM API. innerHTML is banned (XSS).' },
        { property: 'outerHTML', message: 'Use DOM API. outerHTML is banned (XSS).' },
        { object: 'fs', property: 'readFileSync', message: 'Use async fs.promises.readFile instead.' },
        { object: 'fs', property: 'writeFileSync', message: 'Use async fs.promises.writeFile instead.' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.js'],
  },
);
