import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts', '**/*.feature.test.ts'],
    exclude: ['node_modules/**', '.opencode/node_modules/**', 'gateway/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      include: ['hooks/**/*.ts', 'scripts/**/*.ts', 'skills/**/scripts/*.ts', '.cline-plugin/**/*.ts', '.opencode-plugin/**/*.ts'],
      exclude: [
        'node_modules/**',
        '.opencode/node_modules/**',
        'gateway/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/*.test.ts',
        '**/*.feature.test.ts',
        '**/*.steps.ts',
        'vitest.config.ts',
        'scripts/mixining-shared-skills-to-native-skills.ts',
        'skills/**/scripts/svg-to-png.ts',
        'skills/**/scripts/bitmap-to-svg.ts',
        'hooks/post-tool-use/rtk-post-tool-use.ts',
        'hooks/pre-tool-use/rtk-pre-tool-use.ts',
        'hooks/pre-tool-use/powershell-get-content-utf8.ts',
        '.cline-plugin/index.ts',
        '.opencode-plugin/index.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
