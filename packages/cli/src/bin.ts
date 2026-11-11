#!/usr/bin/env node
import { runCli } from './index';

runCli(process.argv.slice(2)).catch((err) => {
  console.error(
    '❌ make-pictures error:',
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});
