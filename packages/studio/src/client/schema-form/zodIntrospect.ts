import type { AnyZodObject, ZodTypeAny } from 'zod';

export type InspectorFieldKind =
  | 'text'
  | 'textarea'
  | 'color'
  | 'style-id'
  | 'range'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'string-array'
  | 'tuple-number'
  | 'json-value';

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
  tupleLength?: number;
}

export interface InspectorSection {
  title: string;
  fields: InspectorFieldSpec[];
}

const HEX_COLOR_RE =
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA_HSLA_COLOR_RE = /^(rgba?|hsla?)\(\s*[^)]+\)$/i;
const COLOR_KEY_HINT_RE = /(color|tint|background|bg|accent|glow)/i;
const STYLE_ID_KEY_RE = /^styleId$|styleId$/i;
const TEXTAREA_KEY_HINT_RE =
  /(description|subtitle|quote|body|copy|prompt|paragraph)/i;

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampAlpha(alpha: number): number {
  if (!Number.isFinite(alpha)) return 1;
  const clamped = Math.max(0, Math.min(1, alpha));
  return Math.round(clamped * 1000) / 1000;
}

function rgbToHex6(r: number, g: number, b: number): string {
  const rr = clampByte(r).toString(16).padStart(2, '0');
  const gg = clampByte(g).toString(16).padStart(2, '0');
  const bb = clampByte(b).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`.toLowerCase();
}

function hslToRgb(
  hDeg: number,
  sPct: number,
  lPct: number
): [number, number, number] {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  const s = Math.max(0, Math.min(1, sPct / 100));
  const l = Math.max(0, Math.min(1, lPct / 100));

  if (s === 0) {
    const v = clampByte(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    clampByte(hue2rgb(p, q, h + 1 / 3) * 255),
    clampByte(hue2rgb(p, q, h) * 255),
    clampByte(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

function parseAlphaToken(raw: string | undefined): number {
  if (!raw) return 1;
  const trimmed = raw.trim();
  if (!trimmed) return 1;
  if (trimmed.endsWith('%')) {
    const pct = Number(trimmed.slice(0, -1));
    return Number.isFinite(pct) ? clampAlpha(pct / 100) : 1;
  }
  const num = Number(trimmed);
  return Number.isFinite(num) ? clampAlpha(num) : 1;
}

export function parseRgbaOrHex(input: string): {
  hex6: string;
  alpha: number;
  isRgba: boolean;
} {
  if (typeof input !== 'string') {
    return { hex6: '#000000', alpha: 1, isRgba: false };
  }
  const trimmed = input.trim();

  if (HEX_COLOR_RE.test(trimmed)) {
    const raw = trimmed.slice(1);
    if (raw.length === 3) {
      const hex6 = `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
      return { hex6, alpha: 1, isRgba: false };
    }
    if (raw.length === 4) {
      const hex6 = `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
      const aa = parseInt(`${raw[3]}${raw[3]}`, 16);
      const alpha = Math.round((aa / 255) * 100) / 100;
      return { hex6, alpha: clampAlpha(alpha), isRgba: false };
    }
    if (raw.length === 6) {
      return { hex6: `#${raw.toLowerCase()}`, alpha: 1, isRgba: false };
    }
    if (raw.length === 8) {
      const hex6 = `#${raw.slice(0, 6).toLowerCase()}`;
      const aa = parseInt(raw.slice(6, 8), 16);
      const alpha = Math.round((aa / 255) * 100) / 100;
      return { hex6, alpha: clampAlpha(alpha), isRgba: false };
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([^)]+)\)$/i);
  if (rgbMatch) {
    const body = rgbMatch[1].trim();
    let parts: string[];
    let alphaRaw: string | undefined;
    if (body.includes(',')) {
      const commaParts = body.split(',').map((p) => p.trim());
      parts = commaParts.slice(0, 3);
      alphaRaw = commaParts[3];
    } else {
      const [channelsPart, slashAlpha] = body.split('/');
      parts = channelsPart.trim().split(/\s+/);
      alphaRaw = slashAlpha;
    }

    if (parts.length >= 3) {
      const parseChannel = (token: string): number => {
        if (token.endsWith('%')) {
          const pct = Number(token.slice(0, -1));
          return Number.isFinite(pct) ? clampByte((pct / 100) * 255) : 0;
        }
        return clampByte(Number(token));
      };
      const r = parseChannel(parts[0]);
      const g = parseChannel(parts[1]);
      const b = parseChannel(parts[2]);
      const alpha = parseAlphaToken(alphaRaw);
      return {
        hex6: rgbToHex6(r, g, b),
        alpha,
        isRgba: true,
      };
    }
  }

  const hslMatch = trimmed.match(/^hsla?\(\s*([^)]+)\)$/i);
  if (hslMatch) {
    const body = hslMatch[1].trim();
    let parts: string[];
    let alphaRaw: string | undefined;
    if (body.includes(',')) {
      const commaParts = body.split(',').map((p) => p.trim());
      parts = commaParts.slice(0, 3);
      alphaRaw = commaParts[3];
    } else {
      const [channelsPart, slashAlpha] = body.split('/');
      parts = channelsPart.trim().split(/\s+/);
      alphaRaw = slashAlpha;
    }

    if (parts.length >= 3) {
      const h = Number(parts[0].replace(/deg$/i, ''));
      const s = Number(parts[1].replace(/%$/, ''));
      const l = Number(parts[2].replace(/%$/, ''));
      if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) {
        const [r, g, b] = hslToRgb(h, s, l);
        const alpha = parseAlphaToken(alphaRaw);
        return {
          hex6: rgbToHex6(r, g, b),
          alpha,
          isRgba: true,
        };
      }
    }
  }

  return { hex6: '#000000', alpha: 1, isRgba: false };
}

export function formatColorWithAlpha(
  hex6: string,
  alpha: number,
  keepAlphaFormat = false
): string {
  const parsed = parseRgbaOrHex(
    hex6.trim().startsWith('#') ? hex6.trim() : `#${hex6.trim()}`
  );
  const cleanHex = parsed.hex6;
  const clampedAlpha = clampAlpha(alpha);

  if (clampedAlpha >= 1 && !keepAlphaFormat) {
    return cleanHex.toUpperCase();
  }

  const r = parseInt(cleanHex.slice(1, 3), 16);
  const g = parseInt(cleanHex.slice(3, 5), 16);
  const b = parseInt(cleanHex.slice(5, 7), 16);
  const roundedAlpha = Math.round(clampedAlpha * 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${roundedAlpha})`;
}

function isColorStringValue(val: unknown, fieldKey: string): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (HEX_COLOR_RE.test(trimmed) || RGBA_HSLA_COLOR_RE.test(trimmed)) {
    return true;
  }
  if (
    COLOR_KEY_HINT_RE.test(fieldKey) &&
    (trimmed.startsWith('#') || /^(rgba?|hsla?)\b/i.test(trimmed))
  ) {
    return true;
  }
  return false;
}

function humanizeKey(raw: string): string {
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function inferDefaultSection(
  fieldKey: string,
  kind: InspectorFieldKind
): string {
  if (
    kind === 'color' ||
    kind === 'style-id' ||
    COLOR_KEY_HINT_RE.test(fieldKey)
  ) {
    return 'Colors & Style';
  }
  if (/(volume|audio|sfx|voice|music)/i.test(fieldKey)) {
    return 'Audio';
  }
  if (/(cam|zoom|fov|offset|pan|distance|height)/i.test(fieldKey)) {
    return 'Camera & Layout';
  }
  if (
    /(title|subtitle|headline|name|role|label|text|caption)/i.test(fieldKey)
  ) {
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
  defaultValue?: unknown;
} {
  let current: ZodTypeAny = schema;
  let description: string | undefined = current?.description;
  let defaultValue: unknown = undefined;

  // Unwrap wrappers (ZodDefault, ZodOptional, ZodNullable, ZodEffects, ZodReadonly)
  for (let depth = 0; depth < 8; depth++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const def = (current as any)?._def;
    if (!def) break;
    if (!description && typeof def.description === 'string') {
      description = def.description;
    }

    const typeName: string | undefined = def.typeName;
    if (typeName === 'ZodDefault') {
      if (defaultValue === undefined && typeof def.defaultValue === 'function') {
        try {
          defaultValue = def.defaultValue();
        } catch {
          // ignore stateful defaults
        }
      }
      current = def.innerType;
      if (!description && current?.description) {
        description = current.description;
      }
      continue;
    }
    if (
      typeName === 'ZodOptional' ||
      typeName === 'ZodNullable' ||
      typeName === 'ZodReadonly'
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

  return { core: current, description, defaultValue };
}

function extractNativeEnumOptions(rawValues: unknown): string[] {
  if (!rawValues || typeof rawValues !== 'object') return [];
  const obj = rawValues as Record<string, string | number>;
  const stringVals: string[] = [];
  const fallbackVals: string[] = [];

  for (const [k, v] of Object.entries(obj)) {
    // Skip reverse numeric enum keys ("0" -> "Name" when obj["Name"] === 0)
    if (!Number.isNaN(Number(k)) && typeof v === 'string' && typeof obj[v] === 'number') {
      continue;
    }
    if (typeof v === 'string') {
      stringVals.push(v);
    } else if (typeof v === 'number') {
      fallbackVals.push(String(v));
    }
  }

  const chosen = stringVals.length > 0 ? stringVals : fallbackVals;
  return Array.from(new Set(chosen));
}

function tryExtractEnumLikeOptions(schema: ZodTypeAny): string[] | null {
  const { core } = unwrapZodType(schema);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (core as any)?._def;
  const typeName: string = def?.typeName ?? '';

  if (typeName === 'ZodLiteral') {
    return [String(def.value)];
  }
  if (typeName === 'ZodEnum') {
    return Array.isArray(def.values) ? def.values.map(String) : [];
  }
  if (typeName === 'ZodNativeEnum') {
    return extractNativeEnumOptions(def.values);
  }
  return null;
}

function computeStep(min: number, max: number, isInt: boolean): number {
  if (isInt) return 1;
  const span = Math.abs(max - min);
  if (span <= 2.5) return 0.01;
  if (span <= 15) return 0.05;
  if (span <= 60) return 0.5;
  return 1;
}

function groupFieldsIntoSections(
  fields: InspectorFieldSpec[]
): InspectorSection[] {
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
      const { core, description, defaultValue } = unwrapZodType(rawFieldSchema);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const def = (core as any)?._def;
      const typeName: string = def?.typeName ?? '';
      const currentVal = getNestedValue(sampleProps, path);
      const effectiveVal =
        currentVal !== undefined ? currentVal : defaultValue;

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

      if (typeName === 'ZodLiteral') {
        const options = [String(def.value)];
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

      if (typeName === 'ZodNativeEnum') {
        const options = extractNativeEnumOptions(def.values);
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

      if (
        typeName === 'ZodUnion' ||
        typeName === 'ZodDiscriminatedUnion'
      ) {
        const rawOptions: ZodTypeAny[] = Array.isArray(def.options)
          ? def.options
          : def.optionsMap instanceof Map
          ? Array.from(def.optionsMap.values())
          : [];

        let allEnumLike = rawOptions.length > 0;
        const collected: string[] = [];
        for (const opt of rawOptions) {
          const optVals = tryExtractEnumLikeOptions(opt);
          if (!optVals || optVals.length === 0) {
            allEnumLike = false;
            break;
          }
          collected.push(...optVals);
        }

        if (allEnumLike) {
          const options = Array.from(new Set(collected));
          const meta = parseDescription(
            description,
            key,
            'enum',
            parentSection
          );
          fields.push({
            path,
            key: path.join('.'),
            section: meta.section,
            label: meta.label,
            kind: 'enum',
            options,
          });
        } else {
          const meta = parseDescription(
            description,
            key,
            'json-value',
            parentSection
          );
          fields.push({
            path,
            key: path.join('.'),
            section: meta.section,
            label: meta.label,
            kind: 'json-value',
          });
        }
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
        const checks: Array<{
          kind: string;
          value?: number;
          regex?: RegExp;
        }> = Array.isArray(def.checks) ? def.checks : [];

        let maxLen: number | undefined;
        let hasColorRegex = false;
        for (const chk of checks) {
          if (chk.kind === 'max' && typeof chk.value === 'number') {
            maxLen = chk.value;
          } else if (chk.kind === 'regex' && chk.regex instanceof RegExp) {
            const src = chk.regex.source;
            if (src.includes('#[0-9a-fA-F]') || src.includes('rgba?')) {
              hasColorRegex = true;
            }
          }
        }

        let kind: InspectorFieldKind;
        if (key === 'styleId' || STYLE_ID_KEY_RE.test(key)) {
          kind = 'style-id';
        } else if (
          isColorStringValue(effectiveVal, key) ||
          (effectiveVal === undefined && hasColorRegex)
        ) {
          kind = 'color';
        } else if (
          (typeof maxLen === 'number' && maxLen > 120) ||
          TEXTAREA_KEY_HINT_RE.test(key) ||
          (typeof effectiveVal === 'string' &&
            (effectiveVal.includes('\n') || effectiveVal.length > 72))
        ) {
          kind = 'textarea';
        } else {
          kind = 'text';
        }

        const meta = parseDescription(description, key, kind, parentSection);

        fields.push({
          path,
          key: path.join('.'),
          section: meta.section,
          label: meta.label,
          kind,
          max: maxLen,
        });
        continue;
      }

      if (typeName === 'ZodArray') {
        const elemSchema: ZodTypeAny | undefined = def.type;
        if (elemSchema) {
          const unwrappedElem = unwrapZodType(elemSchema).core;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const elemDef = (unwrappedElem as any)?._def;
          const elemTypeName: string = elemDef?.typeName ?? '';

          if (elemTypeName === 'ZodString') {
            const meta = parseDescription(
              description,
              key,
              'string-array',
              parentSection
            );
            fields.push({
              path,
              key: path.join('.'),
              section: meta.section,
              label: meta.label,
              kind: 'string-array',
            });
            continue;
          }

          if (elemTypeName === 'ZodEnum') {
            const options: string[] = Array.isArray(elemDef.values)
              ? elemDef.values.map(String)
              : [];
            const meta = parseDescription(
              description,
              key,
              'string-array',
              parentSection
            );
            fields.push({
              path,
              key: path.join('.'),
              section: meta.section,
              label: meta.label,
              kind: 'string-array',
              options,
            });
            continue;
          }
        }

        const meta = parseDescription(
          description,
          key,
          'json-value',
          parentSection
        );
        fields.push({
          path,
          key: path.join('.'),
          section: meta.section,
          label: meta.label,
          kind: 'json-value',
        });
        continue;
      }

      if (typeName === 'ZodTuple') {
        const items: ZodTypeAny[] = Array.isArray(def.items) ? def.items : [];
        const hasRest = Boolean(def.rest);
        const allNumbers =
          !hasRest &&
          items.length >= 2 &&
          items.length <= 4 &&
          items.every((item) => {
            const unwrappedItem = unwrapZodType(item).core;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (unwrappedItem as any)?._def?.typeName === 'ZodNumber';
          });

        if (allNumbers) {
          const allInts = items.every((item) => {
            const unwrappedItem = unwrapZodType(item).core;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const itemChecks = (unwrappedItem as any)?._def?.checks;
            return (
              Array.isArray(itemChecks) &&
              itemChecks.some((c: { kind?: string }) => c.kind === 'int')
            );
          });
          const meta = parseDescription(
            description,
            key,
            'tuple-number',
            parentSection
          );
          fields.push({
            path,
            key: path.join('.'),
            section: meta.section,
            label: meta.label,
            kind: 'tuple-number',
            tupleLength: items.length,
            step: allInts ? 1 : 0.1,
          });
        } else {
          const meta = parseDescription(
            description,
            key,
            'json-value',
            parentSection
          );
          fields.push({
            path,
            key: path.join('.'),
            section: meta.section,
            label: meta.label,
            kind: 'json-value',
          });
        }
        continue;
      }

      // ZodRecord and all remaining / unknown Zod types fall back to JSON editor control
      const meta = parseDescription(
        description,
        key,
        'json-value',
        parentSection
      );
      fields.push({
        path,
        key: path.join('.'),
        section: meta.section,
        label: meta.label,
        kind: 'json-value',
      });
    }
  };

  visitObject(schema, []);
  return groupFieldsIntoSections(fields);
}

function inferFieldSpecFromRuntimeValue(
  path: string[],
  key: string,
  val: unknown,
  overrideSection?: string
): InspectorFieldSpec {
  if (typeof val === 'boolean') {
    const section = overrideSection ?? inferDefaultSection(key, 'boolean');
    return {
      path,
      key: path.join('.'),
      section,
      label: humanizeKey(key),
      kind: 'boolean',
    };
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    const section = overrideSection ?? inferDefaultSection(key, 'number');
    return {
      path,
      key: path.join('.'),
      section,
      label: humanizeKey(key),
      kind: 'number',
      step: Number.isInteger(val) ? 1 : 0.1,
    };
  }

  if (typeof val === 'string') {
    let kind: InspectorFieldKind;
    if (key === 'styleId' || STYLE_ID_KEY_RE.test(key)) {
      kind = 'style-id';
    } else if (isColorStringValue(val, key)) {
      kind = 'color';
    } else if (
      TEXTAREA_KEY_HINT_RE.test(key) ||
      val.includes('\n') ||
      val.length > 72
    ) {
      kind = 'textarea';
    } else {
      kind = 'text';
    }

    const section = overrideSection ?? inferDefaultSection(key, kind);
    return {
      path,
      key: path.join('.'),
      section,
      label: humanizeKey(key),
      kind,
    };
  }

  if (Array.isArray(val)) {
    if (
      val.length >= 2 &&
      val.length <= 4 &&
      val.every((item) => typeof item === 'number' && Number.isFinite(item))
    ) {
      const allInts = val.every((item) => Number.isInteger(item));
      const section =
        overrideSection ?? inferDefaultSection(key, 'tuple-number');
      return {
        path,
        key: path.join('.'),
        section,
        label: humanizeKey(key),
        kind: 'tuple-number',
        tupleLength: val.length,
        step: allInts ? 1 : 0.1,
      };
    }

    if (
      (val.length > 0 && val.every((item) => typeof item === 'string')) ||
      (val.length === 0 && /(tags|keywords|items|list|recommendedFor)/i.test(key))
    ) {
      const section =
        overrideSection ?? inferDefaultSection(key, 'string-array');
      return {
        path,
        key: path.join('.'),
        section,
        label: humanizeKey(key),
        kind: 'string-array',
      };
    }
  }

  const section = overrideSection ?? inferDefaultSection(key, 'json-value');
  return {
    path,
    key: path.join('.'),
    section,
    label: humanizeKey(key),
    kind: 'json-value',
  };
}

export function introspectPropsFallback(
  sampleProps: Record<string, unknown>
): InspectorSection[] {
  if (!sampleProps || typeof sampleProps !== 'object') {
    return [];
  }

  const fields: InspectorFieldSpec[] = [];

  const visitRuntimeObj = (
    obj: Record<string, unknown>,
    prefix: string[],
    parentSection?: string,
    depth = 0
  ) => {
    for (const [key, val] of Object.entries(obj)) {
      if (val === undefined) continue;
      const path = [...prefix, key];

      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        depth < 2
      ) {
        const entries = Object.keys(val as Record<string, unknown>);
        if (entries.length > 0) {
          visitRuntimeObj(
            val as Record<string, unknown>,
            path,
            parentSection ?? humanizeKey(key),
            depth + 1
          );
          continue;
        }
      }

      fields.push(inferFieldSpecFromRuntimeValue(path, key, val, parentSection));
    }
  };

  visitRuntimeObj(sampleProps, []);
  return groupFieldsIntoSections(fields);
}

export function mergeSchemaWithExtraProps(
  sections: InspectorSection[],
  liveProps: Record<string, unknown>
): InspectorSection[] {
  if (!liveProps || typeof liveProps !== 'object') {
    return sections;
  }

  const coveredTopKeys = new Set<string>();
  for (const sec of sections) {
    for (const field of sec.fields) {
      if (field.path.length > 0) {
        coveredTopKeys.add(field.path[0]);
      }
    }
  }

  const extraFields: InspectorFieldSpec[] = [];
  for (const [key, val] of Object.entries(liveProps)) {
    if (val === undefined || coveredTopKeys.has(key)) {
      continue;
    }
    extraFields.push(
      inferFieldSpecFromRuntimeValue([key], key, val, 'Dodatkowe parametry')
    );
  }

  if (extraFields.length === 0) {
    return sections;
  }

  const existingExtraIdx = sections.findIndex(
    (s) => s.title === 'Dodatkowe parametry'
  );
  if (existingExtraIdx !== -1) {
    return sections.map((sec, idx) =>
      idx === existingExtraIdx
        ? { ...sec, fields: [...sec.fields, ...extraFields] }
        : sec
    );
  }

  return [
    ...sections,
    {
      title: 'Dodatkowe parametry',
      fields: extraFields,
    },
  ];
}
