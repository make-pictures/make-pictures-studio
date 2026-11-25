import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInitCommand } from '../src/commands/init';
import {
  detectWorkspaceBootstrapState,
  runOnboardCommand,
} from '../src/commands/onboard';
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
        dependencies: {
          '@make-pictures/remotion': '^3.0.0',
          remotion: '^4.0.545',
        },
        scripts: {
          onboard: 'make-pictures onboard',
          studio: 'remotion studio src/index.ts',
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
      ['@make-pictures', 'remotion'],
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

test('detectWorkspaceBootstrapState detects existing Remotion repo and init preserves src/Root.tsx verbatim', async () => {
  const repoDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'make-pictures-existing-remotion-')
  );
  const existingRootContent = `import React from 'react';
import { Composition } from 'remotion';
import { MyCustomVideo } from './MyCustomVideo';

export const RemotionRoot: React.FC = () => (
  <Composition id="MyCustomVideo" component={MyCustomVideo} durationInFrames={180} fps={30} width={1920} height={1080} />
);
`;

  try {
    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(repoDir, 'package.json'),
      JSON.stringify(
        {
          name: 'existing-remotion-repo',
          private: true,
          dependencies: {
            remotion: '^4.0.545',
            react: '^19.1.0',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(repoDir, 'src', 'Root.tsx'),
      existingRootContent,
      'utf8'
    );

    const state = detectWorkspaceBootstrapState(repoDir);
    assert.equal(state.state, 'existing_remotion');

    // Onboard in agent JSON mode instructs in-place install + init + tandem skills
    const out = createMemoryStdout(true);
    await runOnboardCommand({
      cwd: repoDir,
      lang: 'en',
      deps: {
        stdout: out.stream,
        env: { ANTIGRAVITY_AGENT: '1' },
        checkFfmpeg: () => true,
      },
    });
    const parsed = JSON.parse(out.getOutput().trim()) as {
      next: string;
      run?: string;
      details?: { mode?: string; preserves_root_tsx?: boolean };
    };
    assert.equal(parsed.next, 'run');
    assert.equal(parsed.details?.mode, 'existing_remotion');
    assert.equal(parsed.details?.preserves_root_tsx, true);
    assert.ok(parsed.run);
    assert.match(parsed.run, /@make-pictures\/remotion@latest/);
    assert.match(parsed.run, /make-pictures init/);
    assert.match(parsed.run, /remotion skills add/);

    // Running init in-place MUST preserve src/Root.tsx verbatim and sync skills
    let remotionSkillsCalled = false;
    const initRes = await runInitCommand({
      cwd: repoDir,
      lang: 'en',
      remotionSkillsRunner: () => {
        remotionSkillsCalled = true;
        return true;
      },
    });

    assert.equal(initRes.preservedExistingRoot, true);
    assert.equal(remotionSkillsCalled, true);
    assert.equal(
      fs.readFileSync(path.join(repoDir, 'src', 'Root.tsx'), 'utf8'),
      existingRootContent,
      'Existing src/Root.tsx must never be clobbered by make-pictures init'
    );
    assert.ok(fs.existsSync(path.join(repoDir, 'make-pictures.json')));
    assert.ok(fs.existsSync(path.join(repoDir, '.agents', 'skills')));
    assert.ok(fs.existsSync(path.join(repoDir, '.claude', 'skills')));
  } finally {
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

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
    assert.ok(!printed.trim().startsWith('{'));
    assert.match(printed, /make\.pictures/i);
    assert.match(printed, /https:\/\/elevenlabs\.io\/app\/authorize\?code=ABCD/);
    assert.match(printed, /9876/);
    assert.ok(!printed.includes(secretKey));
    assert.match(printed, /npm run studio/);
    assert.match(printed, /npx remotion skills add/);
    assert.deepEqual(calls, [['connect'], ['connect', '--wait'], ['check']]);

    const envLocal = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
    assert.match(envLocal, /ELEVENLABS_VOICE_ID=/);
    assert.match(envLocal, /ELEVENLABS_MODEL_ID=eleven_v4/);

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
            ['@make-pictures', 'remotion'],
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
    assert.match(printed, /Installing Remotion & make\.pictures dependencies/);
    assert.match(printed, /Onboarding cancelled/i);
    assert.equal(fs.existsSync(path.join(rootDir, '.env.local')), false);
  } finally {
    cleanup();
  }
});

test('bootstrap in empty directory scaffolds into . with tandem remotion skills and --lang=pl', async () => {
  const emptyDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'make-pictures-empty-bootstrap-')
  );
  fs.writeFileSync(path.join(emptyDir, '.DS_Store'), '');
  fs.mkdirSync(path.join(emptyDir, '.git'));
  try {
    const out = createMemoryStdout(true);
    await runOnboardCommand({
      cwd: emptyDir,
      lang: 'pl',
      deps: {
        stdout: out.stream,
        env: { ANTIGRAVITY_AGENT: '1' },
        checkFfmpeg: () => true,
      },
    });
    const parsed = JSON.parse(out.getOutput().trim()) as {
      next: string;
      run?: string;
      say: string;
    };
    assert.equal(parsed.next, 'run');
    assert.ok(parsed.run);
    assert.match(parsed.run, /npx -y create-make-pictures@latest \. --lang=pl/);
    assert.match(parsed.run, /remotion skills add/);
    assert.match(parsed.run, /npm run onboard -- init --lang=pl/);
  } finally {
    fs.rmSync(emptyDir, { recursive: true, force: true });
  }
});

test('bootstrap in existing non-Remotion app asks saas vs standalone and --mode=saas installs v3 Remotion packages only', async () => {
  const appDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'make-pictures-existing-app-')
  );
  fs.writeFileSync(
    path.join(appDir, 'package.json'),
    JSON.stringify({
      name: 'my-nextjs-saas',
      private: true,
      dependencies: { next: '15.0.0', react: '19.1.0' },
    }) + '\n'
  );

  try {
    const askOut = createMemoryStdout(true);
    await runOnboardCommand({
      cwd: appDir,
      lang: 'pl',
      deps: {
        stdout: askOut.stream,
        env: { ANTIGRAVITY_AGENT: '1' },
        checkFfmpeg: () => true,
      },
    });
    const parsedAsk = JSON.parse(askOut.getOutput().trim()) as {
      next: string;
      say: string;
      details?: { choices?: { saas?: string; standalone?: string } };
    };
    assert.equal(parsedAsk.next, 'ask_choice');
    assert.match(parsedAsk.say, /videos\//);
    assert.match(parsedAsk.details?.choices?.saas ?? '', /--mode=saas/);
    assert.match(parsedAsk.details?.choices?.standalone ?? '', /--mode=standalone/);

    const saasOut = createMemoryStdout(true);
    await runOnboardCommand({
      cwd: appDir,
      lang: 'pl',
      mode: 'saas',
      dir: 'videos',
      deps: {
        stdout: saasOut.stream,
        env: { ANTIGRAVITY_AGENT: '1' },
        checkFfmpeg: () => true,
      },
    });
    const parsedSaas = JSON.parse(saasOut.getOutput().trim()) as {
      next: string;
      run?: string;
    };
    assert.equal(parsedSaas.next, 'run');
    assert.ok(parsedSaas.run);
    assert.match(parsedSaas.run, /@make-pictures\/remotion@latest/);
    assert.match(parsedSaas.run, /@make-pictures\/cli@latest/);
    assert.match(parsedSaas.run, /remotion skills add/);
    assert.match(parsedSaas.run, /make-pictures init --dir=videos --lang=pl/);
    assert.doesNotMatch(parsedSaas.run, /vite/i);
  } finally {
    fs.rmSync(appDir, { recursive: true, force: true });
  }
});

test('final check step instructs tandem skills and native Remotion Studio launch with zero legacy server refs', async () => {
  const secretKey = 'sk_live_polish_key_7788';
  const { rootDir, cleanup } = createTempStudioWorkspace({
    envLocalContent: `ELEVENLABS_API_KEY=${secretKey}\n`,
  });

  try {
    const outPl = createMemoryStdout(true);
    await runOnboardCommand({
      cwd: rootDir,
      step: 'check',
      lang: 'pl',
      deps: {
        stdout: outPl.stream,
        env: { ANTIGRAVITY_AGENT: '1' },
        checkFfmpeg: () => true,
        elevenLabsRunner: () => ({ next: 'done', say: 'Ready' }),
      },
    });

    const raw = outPl.getOutput().trim();
    const parsedPl = JSON.parse(raw) as {
      next: string;
      instruction: string;
      say: string;
      details?: {
        remotion_studio?: boolean;
        studio_command?: string;
        remotion_skills_command?: string;
        docs?: string[];
      };
    };
    assert.equal(parsedPl.next, 'ask_what_to_build');
    assert.match(parsedPl.instruction, /npx remotion skills add/);
    assert.match(parsedPl.instruction, /npx remotion studio|npm run studio/);
    assert.match(parsedPl.instruction, /AGENTS\.md/);
    assert.match(parsedPl.say, /Remotion Studio/);
    assert.match(parsedPl.say, /StyleLab/);
    assert.match(parsedPl.say, /Jaki film chcesz stworzyć/i);
    assert.ok(!raw.includes(secretKey));
    assert.ok(!parsedPl.instruction.includes('make-pictures audio'));
    assert.doesNotMatch(raw, /127\.0\.0\.1:3000/);
    assert.equal(parsedPl.details?.remotion_studio, true);
    assert.equal(parsedPl.details?.remotion_skills_command, 'npx remotion skills add');
    assert.ok(parsedPl.details?.docs?.includes('.agents/skills/'));
  } finally {
    cleanup();
  }
});

test('runCli wires --human, --json, --lang, --mode, and --dir flags cleanly to onboard', async () => {
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
    assert.ok(!captured.trim().startsWith('{'));
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
