import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_STYLE_LAB_PROPS,
  StyleLabComposition,
  StyleLabSchema,
} from '../../remotion/src/style-lab';

test('StyleLabSchema validates default props and all 3 dimensional spaces', () => {
  const parsed = StyleLabSchema.parse(DEFAULT_STYLE_LAB_PROPS);
  assert.equal(parsed.space, '2d');
  assert.equal(parsed.styleId, 'editorial-press');

  for (const space of ['2d', '2.5d', '3d'] as const) {
    const res = StyleLabSchema.safeParse({ ...DEFAULT_STYLE_LAB_PROPS, space });
    assert.equal(res.success, true, `space=${space} should be valid`);
  }
  assert.equal(typeof StyleLabComposition, 'function');
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

test('StyleLabSchema validates optional accentOverride color cleanly', () => {
  const validHex = StyleLabSchema.safeParse({
    ...DEFAULT_STYLE_LAB_PROPS,
    accentOverride: '#2563EB',
  });
  assert.equal(validHex.success, true);

  const invalidColor = StyleLabSchema.safeParse({
    ...DEFAULT_STYLE_LAB_PROPS,
    accentOverride: 'not-a-color',
  });
  assert.equal(invalidColor.success, false);
});

test('StyleLabComposition has zero top-level Three.js imports', () => {
  const compPath = path.resolve(
    import.meta.dirname,
    '../../remotion/src/style-lab/StyleLabComposition.tsx'
  );
  const source = fs.readFileSync(compPath, 'utf8');
  assert.doesNotMatch(
    source,
    /from\s+['"](?:three|@react-three\/|@remotion\/three)/
  );
});
