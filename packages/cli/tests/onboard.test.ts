import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runOnboardCommand } from '../src/commands/onboard';
import { runCli } from '../src/index';

function createTempStudioWorkspace(options?: {
  withNodeModules?: boolean;
  envLocalContent?: string;
}): { rootDir: string; cleanup: () => void } {
  const rootDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'make-pictures-onboard-test-')
  );

  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify(
      {
        name: 'test-videos',
        private: true,
        scripts: {
          onboard: 'make-pictures onboard',
          studio: 'make-pictures studio',
          setup: 'make-pictures doctor --setup',
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  if (options?.withNodeModules !== false) {
    for (const pkgParts of [
      ['remotion'],
      ['@remotion', 'player'],
      ['@elevenlabs', 'elevenlabs-js'],
    ]) {
      const dir = path.join(rootDir, 'node_modules', ...pkgParts);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"1.0.0"}\n');
    }
  }

  if (options?.envLocalContent !== undefined) {
    fs.writeFileSync(
      path.join(rootDir, '.env.local'),
      options.envLocalContent,
      'utf8'
    );
  }

  return {
    rootDir,
    cleanup: () => fs.rmSync(rootDir, { recursive: true, force: true }),
  };
}

function createMemoryStdout(isTTY: boolean): {
  stream: { isTTY: boolean; write: (chunk: string) => boolean };
  getOutput: () => string;
} {
  let buf = '';
  return {
    stream: {
      isTTY,
      write(chunk: string) {
        buf += String(chunk);
        return true;
      },
    },
    getOutput: () => buf,
  };
}

test('human interactive terminal runs full connect -> wait -> check flow without raw JSON', async () => {
  const { rootDir, cleanup } = createTempStudioWorkspace();
  try {
    const out = createMemoryStdout(true);
    const calls: string[][] = [];
    const secretKey = 'sk_live_super_secret_9876';

    await runOnboardCommand({
      cwd: rootDir,
      deps: {
        stdout: out.stream,
        env: {},
        checkFfmpeg: () => true,
        elevenLabsRunner: (cwd, args) => {
          calls.push(args);
          if (args[0] === 'connect' && !args.includes('--wait')) {
            return {
              next: 'wait',
              say: 'Open https://elevenlabs.io/app/authorize?code=ABCD in your browser to approve.',
              run: 'elevenlabs onboard connect --wait',
            };
          }
          if (args[0] === 'connect' && args.includes('--wait')) {
            fs.writeFileSync(
              path.join(cwd, '.env.local'),
              `ELEVENLABS_API_KEY=${secretKey}\n`,
              { mode: 0o600 }
            );
            return {
              next: 'run',
              say: 'Saved API key to .env.local.',
              run: 'elevenlabs onboard check',
            };
          }
          if (args[0] === 'check') {
            return {
              next: 'done',
              say: 'ElevenLabs is ready.',
            };
          }
          return null;
        },
      },
    });

    const printed = out.getOutput();
    assert.ok(
      !printed.trim().startsWith('{'),
      `Expected human-readable output in TTY, got raw JSON:\n${printed}`
    );
    assert.match(printed, /make\.pictures/i);
    assert.match(printed, /https:\/\/elevenlabs\.io\/app\/authorize\?code=ABCD/);
    assert.match(printed, /9876/);
    assert.ok(
      !printed.includes(secretKey),
      'Full API key MUST NEVER appear in terminal output'
    );
    assert.match(printed, /npm run studio/);

    assert.deepEqual(calls, [['connect'], ['connect', '--wait'], ['check']]);

    const envLocal = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
    assert.match(envLocal, /ELEVENLABS_VOICE_ID=/);
    assert.match(envLocal, /ELEVENLABS_MODEL_ID=eleven_multilingual_v2/);

    const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
    assert.match(gitignore, /\.env\.local/);
  } finally {
    cleanup();
  }
});

test('human interactive terminal skips connect when valid key already exists in .env.local', async () => {
  const secretKey = 'sk_existing_secret_key_4321';
  const { rootDir, cleanup } = createTempStudioWorkspace({
    envLocalContent: `ELEVENLABS_API_KEY=${secretKey}\n`,
  });
  try {
    const out = createMemoryStdout(true);
    const calls: string[][] = [];

    await runOnboardCommand({
      cwd: rootDir,
      deps: {
        stdout: out.stream,
        env: {},
        checkFfmpeg: () => true,
        elevenLabsRunner: (_cwd, args) => {
          calls.push(args);
          return { next: 'done', say: 'All good' };
        },
      },
    });

    const printed = out.getOutput();
    assert.ok(!printed.trim().startsWith('{'));
    assert.deepEqual(calls, [['check']]);
    assert.match(printed, /4321/);
    assert.ok(!printed.includes(secretKey));
    assert.match(printed, /npm run studio/);
  } finally {
    cleanup();
  }
});

test('human interactive terminal creates .env.local template cleanly when elevenlabs CLI returns null', async () => {
  const { rootDir, cleanup } = createTempStudioWorkspace();
  try {
    const out = createMemoryStdout(true);

    await runOnboardCommand({
      cwd: rootDir,
      deps: {
        stdout: out.stream,
        env: {},
        checkFfmpeg: () => true,
        elevenLabsRunner: () => null,
      },
    });

    const printed = out.getOutput();
    assert.ok(!printed.trim().startsWith('{'));
    assert.match(printed, /\.env\.local/);
    assert.match(printed, /elevenlabs\.io\/app\/settings\/api-keys/);
    assert.ok(fs.existsSync(path.join(rootDir, '.env.local')));
  } finally {
    cleanup();
  }
});

test('agent environment (ANTIGRAVITY_AGENT or non-TTY or --json) preserves deterministic single-line JSON protocol', async () => {
  const { rootDir, cleanup } = createTempStudioWorkspace();
  try {
    // 1. Agent env even when stdout is a PTY (isTTY = true)
    const ptyAgentOut = createMemoryStdout(true);
    await runOnboardCommand({
      cwd: rootDir,
      deps: {
        stdout: ptyAgentOut.stream,
        env: { ANTIGRAVITY_AGENT: '1' },
        checkFfmpeg: () => true,
      },
    });
    const parsedAgent = JSON.parse(ptyAgentOut.getOutput().trim()) as {
      next: string;
      run?: string;
    };
    assert.equal(parsedAgent.next, 'run');
    assert.equal(parsedAgent.run, 'npm run onboard -- connect');

    // 2. Non-TTY piped stdout with clean env
    const pipedOut = createMemoryStdout(false);
    await runOnboardCommand({
      cwd: rootDir,
      deps: {
        stdout: pipedOut.stream,
        env: {},
        checkFfmpeg: () => true,
      },
    });
    const parsedPiped = JSON.parse(pipedOut.getOutput().trim()) as {
      next: string;
      run?: string;
    };
    assert.equal(parsedPiped.next, 'run');
    assert.equal(parsedPiped.run, 'npm run onboard -- connect');

    // 3. Explicit --json flag on human TTY preserves --json in follow-up run commands
    const explicitJsonOut = createMemoryStdout(true);
    await runOnboardCommand({
      cwd: rootDir,
      json: true,
      deps: {
        stdout: explicitJsonOut.stream,
        env: {},
        checkFfmpeg: () => true,
      },
    });
    const parsedExplicit = JSON.parse(explicitJsonOut.getOutput().trim()) as {
      next: string;
      run?: string;
    };
    assert.equal(parsedExplicit.next, 'run');
    assert.equal(parsedExplicit.run, 'npm run onboard -- connect --json');
  } finally {
    cleanup();
  }
});

test('human interactive terminal installs missing dependencies automatically before connecting', async () => {
  const { rootDir, cleanup } = createTempStudioWorkspace({
    withNodeModules: false,
  });
  try {
    const out = createMemoryStdout(true);
    let installCalled = false;

    await runOnboardCommand({
      cwd: rootDir,
      deps: {
        stdout: out.stream,
        env: {},
        checkFfmpeg: () => true,
        installDeps: (dir) => {
          installCalled = true;
          for (const pkgParts of [
            ['remotion'],
            ['@remotion', 'player'],
            ['@elevenlabs', 'elevenlabs-js'],
          ]) {
            const pkgDir = path.join(dir, 'node_modules', ...pkgParts);
            fs.mkdirSync(pkgDir, { recursive: true });
            fs.writeFileSync(
              path.join(pkgDir, 'package.json'),
              '{"version":"1.0.0"}\n'
            );
          }
          return true;
        },
        elevenLabsRunner: () => ({
          next: 'cancelled',
          say: 'Cancelled by user.',
        }),
      },
    });

    assert.equal(installCalled, true);
    const printed = out.getOutput();
    assert.match(printed, /Installing make\.pictures Studio dependencies/);
    assert.match(printed, /Onboarding cancelled/i);
    assert.equal(
      fs.existsSync(path.join(rootDir, '.env.local')),
      false,
      'Cancellation should not create a placeholder .env.local'
    );
  } finally {
    cleanup();
  }
});

test('runCli wires --human and --json flags to onboard command', async () => {
  const { rootDir, cleanup } = createTempStudioWorkspace();
  const origWrite = process.stdout.write.bind(process.stdout);
  let captured = '';
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    captured +=
      typeof chunk === 'string'
        ? chunk
        : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;

  try {
    await runCli(['onboard', 'status', `--cwd=${rootDir}`, '--human']);
    assert.ok(
      !captured.trim().startsWith('{'),
      `Expected --human to emit human text even inside agent shell, got:\n${captured}`
    );
    assert.match(captured, /not configured in \.env\.local yet/i);

    captured = '';
    await runCli(['onboard', `--cwd=${rootDir}`, '--json']);
    const parsedJson = JSON.parse(captured.trim()) as {
      next: string;
      run?: string;
    };
    assert.equal(parsedJson.next, 'run');
    assert.equal(parsedJson.run, 'npm run onboard -- connect --json');
  } finally {
    process.stdout.write = origWrite;
    cleanup();
  }
});
