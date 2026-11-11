import type { AnyZodObject, ZodTypeAny } from 'zod';

export type InspectorFieldKind =
  | 'text'
  | 'color'
  | 'range'
  | 'number'
  | 'boolean'
  | 'enum';

export interface InspectorFieldSpec {
  /** Dot-separated path in props object (e.g. "bannerTitle" or "camera.fov") */
  path: string[];
  key: string;
  section: string;
  label: string;
  kind: InspectorFieldKind;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface InspectorSection {
  title: string;
  fields: InspectorFieldSpec[];
}

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const COLOR_KEY_HINT_RE = /(color|tint|background|bg|accent|glow)/i;

function humanizeKey(raw: string): string {
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function inferDefaultSection(fieldKey: string, kind: InspectorFieldKind): string {
  if (kind === 'color' || COLOR_KEY_HINT_RE.test(fieldKey)) {
    return 'Colors & Style';
  }
  if (/(volume|audio|sfx|voice|music)/i.test(fieldKey)) {
    return 'Audio';
  }
  if (/(cam|zoom|fov|offset|pan|distance|height)/i.test(fieldKey)) {
    return 'Camera & Layout';
  }
  if (/(title|subtitle|headline|name|role|label|text|caption)/i.test(fieldKey)) {
    return 'Text & Labels';
  }
  return 'Scene Parameters';
}

function parseDescription(
  description: string | undefined,
  fallbackKey: string,
  kind: InspectorFieldKind,
  parentSection?: string
): { section: string; label: string } {
  if (description) {
    const sepIdx = description.indexOf('::');
    if (sepIdx !== -1) {
      const sec = description.slice(0, sepIdx).trim();
      const lbl = description.slice(sepIdx + 2).trim();
      if (sec && lbl) {
        return { section: sec, label: lbl };
      }
    }
    return {
      section: parentSection ?? inferDefaultSection(fallbackKey, kind),
      label: description.trim(),
    };
  }

  return {
    section: parentSection ?? inferDefaultSection(fallbackKey, kind),
    label: humanizeKey(fallbackKey),
  };
}

function unwrapZodType(schema: ZodTypeAny): {
  core: ZodTypeAny;
  description?: string;
} {
  let current: ZodTypeAny = schema;
  let description: string | undefined = current.description;

  // Unwrap wrappers (ZodDefault, ZodOptional, ZodNullable, ZodEffects)
  for (let depth = 0; depth < 8; depth++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const def = (current as any)?._def;
    if (!def) break;
    if (!description && typeof def.description === 'string') {
      description = def.description;
    }

    const typeName: string | undefined = def.typeName;
    if (
      typeName === 'ZodDefault' ||
      typeName === 'ZodOptional' ||
      typeName === 'ZodNullable'
    ) {
      current = def.innerType;
      if (!description && current?.description) {
        description = current.description;
      }
      continue;
    }
    if (typeName === 'ZodEffects') {
      current = def.schema;
      if (!description && current?.description) {
        description = current.description;
      }
      continue;
    }
    break;
  }

  return { core: current, description };
}

function computeStep(min: number, max: number, isInt: boolean): number {
  if (isInt) return 1;
  const span = Math.abs(max - min);
  if (span <= 2.5) return 0.01;
  if (span <= 15) return 0.05;
  if (span <= 60) return 0.5;
  return 1;
}

export function getNestedValue(
  obj: Record<string, unknown>,
  path: string[]
): unknown {
  let curr: unknown = obj;
  for (const part of path) {
    if (curr === null || typeof curr !== 'object') return undefined;
    curr = (curr as Record<string, unknown>)[part];
  }
  return curr;
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown
): Record<string, unknown> {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  if (rest.length === 0) {
    return {
      ...obj,
      [head]: value,
    };
  }
  const child =
    obj[head] && typeof obj[head] === 'object'
      ? (obj[head] as Record<string, unknown>)
      : {};
  return {
    ...obj,
    [head]: setNestedValue(child, rest, value),
  };
}

export function introspectZodObject(
  schema: AnyZodObject | undefined,
  sampleProps: Record<string, unknown>
): InspectorSection[] {
  if (!schema) return [];

  const fields: InspectorFieldSpec[] = [];

  const visitObject = (
    objSchema: AnyZodObject,
    prefix: string[],
    parentSection?: string
  ) => {
    const shape =
      typeof objSchema._def.shape === 'function'
        ? objSchema._def.shape()
        : objSchema._def.shape;

    for (const [key, rawFieldSchema] of Object.entries(
      shape as Record<string, ZodTypeAny>
    )) {
      const path = [...prefix, key];
      const { core, description } = unwrapZodType(rawFieldSchema);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const def = (core as any)?._def;
      const typeName: string = def?.typeName ?? '';
      const currentVal = getNestedValue(sampleProps, path);

      if (typeName === 'ZodObject') {
        const groupName = description
          ? description.split('::')[0].trim()
          : humanizeKey(key);
        visitObject(core as AnyZodObject, path, groupName);
        continue;
      }

      if (typeName === 'ZodBoolean') {
        const meta = parseDescription(
          description,
          key,
          'boolean',
          parentSection
        );
        fields.push({
          path,
          key: path.join('.'),
          section: meta.section,
          label: meta.label,
          kind: 'boolean',
        });
        continue;
      }

      if (typeName === 'ZodEnum') {
        const options: string[] = Array.isArray(def.values)
          ? def.values.map(String)
          : [];
        const meta = parseDescription(description, key, 'enum', parentSection);
        fields.push({
          path,
          key: path.join('.'),
          section: meta.section,
          label: meta.label,
          kind: 'enum',
          options,
        });
        continue;
      }

      if (typeName === 'ZodNumber') {
        const checks: Array<{ kind: string; value?: number }> = Array.isArray(
          def.checks
        )
          ? def.checks
          : [];
        let min: number | undefined;
        let max: number | undefined;
        let isInt = false;

        for (const chk of checks) {
          if (chk.kind === 'min' && typeof chk.value === 'number') {
            min = chk.value;
          } else if (chk.kind === 'max' && typeof chk.value === 'number') {
            max = chk.value;
          } else if (chk.kind === 'int') {
            isInt = true;
          }
        }

        const hasBounds = typeof min === 'number' && typeof max === 'number';
        const kind: InspectorFieldKind = hasBounds ? 'range' : 'number';
        const meta = parseDescription(description, key, kind, parentSection);

        fields.push({
          path,
          key: path.join('.'),
          section: meta.section,
          label: meta.label,
          kind,
          min,
          max,
          step: hasBounds ? computeStep(min!, max!, isInt) : isInt ? 1 : 0.1,
        });
        continue;
      }

      if (typeName === 'ZodString') {
        const isHexColor =
          (typeof currentVal === 'string' && HEX_COLOR_RE.test(currentVal)) ||
          (COLOR_KEY_HINT_RE.test(key) &&
            typeof currentVal === 'string' &&
            currentVal.startsWith('#'));

        const kind: InspectorFieldKind = isHexColor ? 'color' : 'text';
        const meta = parseDescription(description, key, kind, parentSection);

        fields.push({
          path,
          key: path.join('.'),
          section: meta.section,
          label: meta.label,
          kind,
        });
      }
    }
  };

  visitObject(schema, []);

  // Group into ordered sections while preserving declaration order
  const sectionMap = new Map<string, InspectorFieldSpec[]>();
  for (const field of fields) {
    const list = sectionMap.get(field.section) ?? [];
    list.push(field);
    sectionMap.set(field.section, list);
  }

  return Array.from(sectionMap.entries()).map(([title, sectionFields]) => ({
    title,
    fields: sectionFields,
  }));
}
