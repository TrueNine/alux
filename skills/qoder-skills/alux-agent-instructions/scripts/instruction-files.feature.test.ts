import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, runCucumber } from '@cucumber/cucumber/api';
import { expect, test } from 'vitest';

const directory = fileURLToPath(new URL('.', import.meta.url));

test('instruction-files feature', async () => {
  const { runConfiguration } = await loadConfiguration({
    file: false,
    provided: {
      paths: [join(directory, 'instruction-files.feature')],
      import: [join(directory, 'instruction-files.steps.ts')],
      format: ['progress'],
    },
  });
  const { success } = await runCucumber(runConfiguration);
  expect(success).toBe(true);
}, 60000);
