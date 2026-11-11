import path from 'node:path';
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setPixelFormat('yuv420p');
Config.setCodec('h264');

Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    resolve: {
      ...currentConfiguration.resolve,
      alias: {
        ...(currentConfiguration.resolve?.alias ?? {}),
        '@make-pictures/core': path.resolve(process.cwd(), 'packages/core/src'),
        '@make-pictures/kits': path.resolve(process.cwd(), 'packages/kits/src'),
        '@make-pictures/studio': path.resolve(
          process.cwd(),
          'packages/studio/src'
        ),
      },
    },
  };
});
