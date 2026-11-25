import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  assertRemotionInstalled,
  resolveRemotionEntryPoint,
  resolveWorkspaceContext,
} from './workspace-paths';

export interface StudioCommandOptions {
  cwd?: string;
  dir?: string;
  entryPoint?: string;
  port?: number;
  host?: string;
}

const VALID_HOST_RE = /^[A-Za-z0-9.:-]+$/;
const UNSAFE_SHELL_CHARS_RE = /[\0\r\n&|;<>^%!$`"']/;

/**
 * Thin passthrough launching native `remotion studio <entryPoint>`
 * after verifying that Remotion and a valid entry point exist.
 */
export async function runStudioCommand(
  options: StudioCommandOptions = {}
): Promise<void> {
  const { rootDir, studioDir, dirRel } = resolveWorkspaceContext({
    cwd: options.cwd,
    dir: options.dir,
  });

  const remotionBin = assertRemotionInstalled(rootDir, [
    'remotion',
    '@remotion/cli',
  ]);
  const entryPoint = resolveRemotionEntryPoint({
    rootDir,
    studioDir,
    explicitEntry: options.entryPoint,
  });
  const relEntry = path.relative(rootDir, entryPoint) || entryPoint;
  if (UNSAFE_SHELL_CHARS_RE.test(relEntry)) {
    throw new Error(
      `Invalid Remotion entry path "${relEntry}": contains unsafe shell characters.`
    );
  }

  const args = ['studio', relEntry];
  if (typeof options.port === 'number' && Number.isFinite(options.port)) {
    args.push(`--port=${Math.round(options.port)}`);
  }
  if (options.host !== undefined && options.host.trim().length > 0) {
    const cleanHost = options.host.trim();
    if (!VALID_HOST_RE.test(cleanHost)) {
      throw new Error(
        `Invalid --host value "${options.host}". Expected a hostname or IP address (e.g. 127.0.0.1, localhost, 0.0.0.0).`
      );
    }
    args.push(`--host=${cleanHost}`);
  }

  console.log('==============================================================');
  console.log(' 🎬 make.pictures — Launching Native Remotion Studio');
  console.log('==============================================================');
  console.log(`  • Entry:      ${relEntry}`);
  console.log(
    `  • Workspace:  ${dirRel === '.' ? rootDir : `${rootDir} (--dir=${dirRel})`}`
  );
  console.log(`  • Command:    remotion ${args.join(' ')}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(remotionBin, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', (err) => {
      reject(
        new Error(
          `Failed to launch Remotion Studio: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    });

    child.on('exit', (code, signal) => {
      if (signal === 'SIGINT' || signal === 'SIGTERM' || code === 0 || code === null) {
        resolve();
        return;
      }
      reject(new Error(`Remotion Studio exited with code ${code}.`));
    });
  });
}
