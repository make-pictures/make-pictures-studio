#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type StarterSpace = '2d' | '2.5d' | '3d';
export type StarterKitId =
  | 'editorial-collage'
  | 'vector-scene-2d'
  | 'kinetic-typography'
  | 'data-storytelling'
  | 'motion-diagrams-2d'
  | 'paper-diorama-3d'
  | 'isometric-3d';

export interface CreateMakePicturesOptions {
  targetDir: string;
  space?: StarterSpace;
  kit?: StarterKitId;
  style?: string;
  lang?: 'pl' | 'en';
  install?: boolean;
  force?: boolean;
}

const VALID_SPACES = new Set<StarterSpace>(['2d', '2.5d', '3d']);
const VALID_KITS = new Set<StarterKitId>([
  'editorial-collage', 'vector-scene-2d', 'kinetic-typography',
  'data-storytelling', 'motion-diagrams-2d', 'paper-diorama-3d', 'isometric-3d',
]);
const IGNORABLE_ENTRIES = new Set([
  '.DS_Store', 'Thumbs.db', '.git', '.gitignore', '.vscode',
  '.idea', '.claude', '.agents', '.antigravity', '.cursor',
]);

export function isEffectivelyEmptyDir(dirPath: string): boolean {
  return !fs.existsSync(dirPath) || fs.readdirSync(dirPath).every((e) => IGNORABLE_ENTRIES.has(e));
}

function sanitizePackageName(dirName: string): string {
  return dirName.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '') || 'my-remotion-films';
}

function mergeGitignore(targetDir: string): void {
  const filePath = path.join(targetDir, '.gitignore');
  const required = ['node_modules/', 'out/', 'dist/', '.env.local', '.DS_Store'];
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${required.join('\n')}\n`, 'utf8');
    return;
  }
  const existing = fs.readFileSync(filePath, 'utf8');
  const lines = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  const missing = required.filter((e) => !lines.has(e));
  if (missing.length > 0) {
    const prefix = existing.endsWith('\n') || existing.length === 0 ? '' : '\n';
    fs.appendFileSync(filePath, `${prefix}${missing.join('\n')}\n`, 'utf8');
  }
}

function buildPackageJson(name: string): Record<string, unknown> {
  return {
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      studio: 'remotion studio src/index.ts',
      render: 'make-pictures render',
      qa: 'make-pictures qa',
      audio: 'make-pictures audio',
      voices: 'make-pictures voices',
      styles: 'make-pictures styles',
      new: 'make-pictures new',
      onboard: 'make-pictures onboard',
      doctor: 'make-pictures doctor',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@make-pictures/remotion': '^3.0.0',
      '@remotion/bundler': '^4.0.545',
      '@remotion/cli': '^4.0.545',
      '@remotion/google-fonts': '^4.0.545',
      '@remotion/media-utils': '^4.0.545',
      '@remotion/renderer': '^4.0.545',
      '@remotion/zod-types': '^4.0.545',
      'lucide-react': '^0.475.0',
      react: '^19.1.0',
      'react-dom': '^19.1.0',
      remotion: '^4.0.545',
      zod: '^3.24.2',
    },
    devDependencies: {
      '@make-pictures/cli': '^3.0.0',
      '@types/react': '^19.1.0',
      '@types/react-dom': '^19.1.0',
      typescript: '^5.7.3',
    },
  };
}

function buildRootTsx(options: { style?: string; space?: StarterSpace }): string {
  const propsExpr =
    options.style || options.space
      ? `{ ...DEFAULT_STYLE_LAB_PROPS${options.style ? `, styleId: ${JSON.stringify(options.style)}` : ''}${options.space ? `, space: ${JSON.stringify(options.space)}` : ''} }`
      : 'DEFAULT_STYLE_LAB_PROPS';

  return `import React from 'react';
import { Composition } from 'remotion';
import {
  DEFAULT_STYLE_LAB_PROPS,
  StyleLabComposition,
  StyleLabSchema,
} from '@make-pictures/remotion/style-lab';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="StyleLab"
      component={StyleLabComposition}
      schema={StyleLabSchema}
      defaultProps={${propsExpr}}
      durationInFrames={360}
      fps={60}
      width={1920}
      height={1080}
    />
  </>
);
`;
}

export async function createMakePicturesApp(
  options: CreateMakePicturesOptions
): Promise<{ targetDir: string; projectName: string }> {
  const targetDir = path.resolve(process.cwd(), options.targetDir);
  const projectName = sanitizePackageName(path.basename(targetDir));
  const lang: 'pl' | 'en' = options.lang === 'pl' ? 'pl' : 'en';

  if (fs.existsSync(targetDir) && !isEffectivelyEmptyDir(targetDir) && !options.force) {
    throw new Error(
      `Target directory "${targetDir}" is not empty. Pass --force to scaffold anyway, or choose a new folder.`
    );
  }

  for (const sub of ['src', 'src/videos', 'styles', 'public']) {
    fs.mkdirSync(path.join(targetDir, sub), { recursive: true });
  }

  fs.writeFileSync(path.join(targetDir, 'package.json'), `${JSON.stringify(buildPackageJson(projectName), null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(targetDir, 'tsconfig.json'),
    `${JSON.stringify({
      compilerOptions: {
        target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler',
        jsx: 'react-jsx', strict: true, esModuleInterop: true, skipLibCheck: true, noEmit: true,
      },
      include: ['src', 'remotion.config.ts'],
    }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(targetDir, 'remotion.config.ts'),
    `import { Config } from '@remotion/cli/config';\n\nConfig.setVideoImageFormat('jpeg');\nConfig.setOverwriteOutput(true);\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(targetDir, 'make-pictures.json'),
    `${JSON.stringify({ entryPoint: 'src/index.ts', publicDir: 'public', videosDir: 'src/videos', stylesDir: 'styles', lang, fps: 60 }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(targetDir, 'src', 'index.ts'),
    `import { registerRoot } from 'remotion';\nimport { RemotionRoot } from './Root';\n\nregisterRoot(RemotionRoot);\n`,
    'utf8'
  );
  fs.writeFileSync(path.join(targetDir, 'src', 'Root.tsx'), buildRootTsx({ style: options.style, space: options.space }), 'utf8');

  const defaultVoiceId = lang === 'pl' ? 'C8ZVSJxcymeT86xT429O' : 'JBFqnCBsd6RMkjVDRZzb';
  fs.writeFileSync(
    path.join(targetDir, '.env.example'),
    `ELEVENLABS_API_KEY=your_elevenlabs_api_key_here\nELEVENLABS_VOICE_ID=${defaultVoiceId}\nELEVENLABS_MODEL_ID=eleven_v4\n`,
    'utf8'
  );
  mergeGitignore(targetDir);

  if (options.install !== false) {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const res = spawnSync(npmCmd, ['install'], { cwd: targetDir, stdio: 'inherit' });
    if (res.status !== 0) {
      throw new Error(`npm install exited with status ${res.status ?? 1}. Re-run \`npm install\` inside ${targetDir}.`);
    }
    spawnSync('npx', ['make-pictures', 'init', `--lang=${lang}`], { cwd: targetDir, stdio: 'inherit' });
  }

  const relDisplay = path.relative(process.cwd(), targetDir) || '.';
  console.log(`\n🎬 Created Remotion + make.pictures v3 project: ${projectName}`);
  console.log(`   Location: ${targetDir}`);
  console.log(`   Next: ${relDisplay !== '.' ? `cd ${relDisplay} && ` : ''}${options.install === false ? 'npm install && ' : ''}npx remotion skills add && npm run onboard && npm run studio`);
  return { targetDir, projectName };
}

function parseArgs(argv: string[]): { positionals: string[]; flags: Record<string, string | boolean> } {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') flags.help = true;
    else if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) flags[arg.slice(2)] = argv[++i];
      else flags[arg.slice(2)] = true;
    } else positionals.push(arg);
  }
  return { positionals, flags };
}

export async function runCreateCli(argv = process.argv.slice(2)): Promise<void> {
  const { positionals, flags } = parseArgs(argv);
  if (flags.help || positionals.length === 0) {
    console.log('create-make-pictures (v3.0.0)\nUsage: npx create-make-pictures@latest <dir> [--space=2d|2.5d|3d] [--style=<id>] [--lang=en|pl] [--no-install] [--force]');
    if (!flags.help && positionals.length === 0) {
      throw new Error('Missing <project-directory>. Usage: npx create-make-pictures@latest my-films');
    }
    return;
  }
  const space = typeof flags.space === 'string' ? (flags.space.trim().toLowerCase() as StarterSpace) : undefined;
  if (space && !VALID_SPACES.has(space)) throw new Error(`Invalid --space "${flags.space}". Expected: 2d, 2.5d, 3d.`);
  const kit = typeof flags.kit === 'string' ? (flags.kit.trim() as StarterKitId) : undefined;
  if (kit && !VALID_KITS.has(kit)) throw new Error(`Unknown --kit "${flags.kit}".`);

  await createMakePicturesApp({
    targetDir: positionals[0],
    space,
    kit,
    style: typeof flags.style === 'string' ? flags.style.trim() : undefined,
    lang: flags.lang === 'pl' ? 'pl' : 'en',
    install: !Boolean(flags['no-install']),
    force: Boolean(flags.force),
  });
}

const selfFile = typeof __filename === 'string' ? __filename : import.meta.url ? fileURLToPath(import.meta.url) : null;
if (process.argv[1] && selfFile && fs.realpathSync(process.argv[1]) === fs.realpathSync(selfFile)) {
  runCreateCli().catch((err) => {
    console.error('❌ create-make-pictures error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
