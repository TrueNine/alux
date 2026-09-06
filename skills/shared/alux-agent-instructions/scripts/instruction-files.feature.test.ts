import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { loadConfiguration, runCucumber } from '@cucumber/cucumber/api';

const directory = import.meta.dir;

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
