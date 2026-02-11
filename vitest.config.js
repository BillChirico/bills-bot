import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: [
        // Entry points and Discord infrastructure
        'src/deploy-commands.js',
        'src/index.js',
        'src/db.js',
        'src/logger.js',
        // Modules requiring Discord client/interactions
        'src/modules/ai.js',
        'src/modules/chimeIn.js',
        'src/modules/config.js',
        'src/modules/events.js',
        'src/modules/welcome.js',
        'src/modules/spam.js',
        // Commands requiring Discord interactions
        'src/commands/**/*.js',
        // Utils requiring Discord REST API
        'src/utils/registerCommands.js',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
