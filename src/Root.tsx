import React from 'react';
import { Composition } from 'remotion';
import { STUDIO_COMPOSITIONS } from './compositions/registry';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {STUDIO_COMPOSITIONS.map((entry) => (
        <Composition
          key={entry.id}
          id={entry.id}
          component={entry.component}
          durationInFrames={entry.durationInFrames}
          fps={entry.fps}
          width={entry.width}
          height={entry.height}
          defaultProps={entry.defaultProps}
          {...(entry.schema ? { schema: entry.schema } : {})}
        />
      ))}
    </>
  );
};
