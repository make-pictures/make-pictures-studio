import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_STYLE_LAB_PROPS,
  StyleLabComposition,
  StyleLabSchema,
} from '../../remotion/src/style-lab';
import { BUILTIN_VISUAL_KIT_IDS } from '../../remotion/src/types';

test('StyleLabSchema validates default props and all 3 dimensional spaces', () => {
  const parsed = StyleLabSchema.parse(DEFAULT_STYLE_LAB_PROPS);
  assert.equal(parsed.space, '2d');
  assert.equal(parsed.styleId, 'editorial-press');
  assert.equal(parsed.kit, 'editorial-collage');

  for (const space of ['2d', '2.5d', '3d'] as const) {
    const res = StyleLabSchema.safeParse({ ...DEFAULT_STYLE_LAB_PROPS, space });
    assert.equal(res.success, true, `space=${space} should be valid`);
  }
  assert.equal(typeof StyleLabComposition, 'function');
});

test('StyleLabSchema validates optional kit prop across all 10 built-in kits', () => {
  assert.equal(BUILTIN_VISUAL_KIT_IDS.length, 10);

  const withoutKit = StyleLabSchema.safeParse({
    space: DEFAULT_STYLE_LAB_PROPS.space,
    styleId: DEFAULT_STYLE_LAB_PROPS.styleId,
    headline: DEFAULT_STYLE_LAB_PROPS.headline,
    subtitle: DEFAULT_STYLE_LAB_PROPS.subtitle,
  });
  assert.equal(withoutKit.success, true, 'kit should remain optional');

  for (const kit of BUILTIN_VISUAL_KIT_IDS) {
    const res = StyleLabSchema.safeParse({ ...DEFAULT_STYLE_LAB_PROPS, kit });
    assert.equal(res.success, true, `kit=${kit} should be valid`);
  }

  const invalidKit = StyleLabSchema.safeParse({
    ...DEFAULT_STYLE_LAB_PROPS,
    kit: 'unknown-kit',
  });
  assert.equal(invalidKit.success, false, 'unknown kit must be rejected');
});

test('StyleLabSchema rejects unknown styleId or space', () => {
  assert.equal(
    StyleLabSchema.safeParse({ ...DEFAULT_STYLE_LAB_PROPS, space: '4d' }).success,
    false
  );
  assert.equal(
    StyleLabSchema.safeParse({ ...DEFAULT_STYLE_LAB_PROPS, styleId: '' }).success,
    false
  );
  assert.equal(
    StyleLabSchema.safeParse({
      ...DEFAULT_STYLE_LAB_PROPS,
      styleId: 'non-existent-preset',
    }).success,
    false
  );
});

test('StyleLabSchema validates optional accentOverride color cleanly with Remotion color brand', () => {
  assert.equal(
    StyleLabSchema.shape.accentOverride.unwrap().description,
    '__remotion-color'
  );

  const validHex = StyleLabSchema.safeParse({
    ...DEFAULT_STYLE_LAB_PROPS,
    accentOverride: '#2563EB',
  });
  assert.equal(validHex.success, true);

  const validRgb = StyleLabSchema.safeParse({
    ...DEFAULT_STYLE_LAB_PROPS,
    accentOverride: 'rgb(37, 99, 235)',
  });
  assert.equal(validRgb.success, true);

  const invalidColor = StyleLabSchema.safeParse({
    ...DEFAULT_STYLE_LAB_PROPS,
    accentOverride: 'not-a-color',
  });
  assert.equal(invalidColor.success, false);
});

test('StyleLabComposition has zero top-level Three.js or optional @remotion/zod-types imports', () => {
  const compPath = path.resolve(
    import.meta.dirname,
    '../../remotion/src/style-lab/StyleLabComposition.tsx'
  );
  const source = fs.readFileSync(compPath, 'utf8');
  assert.doesNotMatch(
    source,
    /from\s+['"](?:three|@react-three\/|@remotion\/three)/
  );
  assert.doesNotMatch(source, /from\s+['"]@remotion\/zod-types['"]/);
});
