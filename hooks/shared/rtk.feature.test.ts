import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { loadConfiguration, runCucumber } from '@cucumber/cucumber/api';

const directory = import.meta.dir;

test('rtk hooks feature', async () => {
  const { runConfiguration } = await loadConfiguration({
    file: false,
    provided: {
      paths: [join(directory, 'rtk.feature')],
      import: [join(directory, 'rtk.steps.ts')],
      format: ['progress'],
    },
  });
  const { success } = await runCucumber(runConfiguration);
  expect(success).toBe(true);
}, 60000);
