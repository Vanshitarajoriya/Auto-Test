// Card -> tests. Pure lookup in mapping.json. No AI, no guessing.
import { readFileSync } from 'node:fs';

export const loadMapping = (path = new URL('../mapping.json', import.meta.url)) => JSON.parse(readFileSync(path, 'utf8'));

const norm = (s) => String(s).trim().toLowerCase();

/** status: needs-fields | manual-needed | ok. `unmappedFeatures` are features with no tests yet. */
export function lookupTests(mapping, moduleName, features) {
  if (!moduleName || !features?.length) return { status: 'needs-fields', ids: [], unmappedFeatures: [] };

  const modKey = Object.keys(mapping).find((k) => !k.startsWith('_') && norm(k) === norm(moduleName));
  if (!modKey) {
    return { status: 'manual-needed', ids: [], unmappedFeatures: features, reason: `module "${moduleName}" is not in mapping.json` };
  }

  const ids = new Set();
  const unmappedFeatures = [];
  for (const feat of features) {
    const fk = Object.keys(mapping[modKey]).find((k) => norm(k) === norm(feat));
    const arr = fk ? mapping[modKey][fk] : [];
    if (!arr.length) unmappedFeatures.push(feat);
    arr.forEach((id) => ids.add(id));
  }
  if (!ids.size) return { status: 'manual-needed', ids: [], unmappedFeatures, reason: 'no tests mapped yet', module: modKey };
  return { status: 'ok', ids: [...ids], unmappedFeatures, module: modKey };
}

/** Compares the ClickUp dropdown options with mapping.json names (case-insensitive). Platform = internal self-test module, ignored. */
export function diffMapping(mapping, modules, features) {
  const mapModules = Object.keys(mapping).filter((k) => !k.startsWith('_') && k !== 'Platform');
  const mapFeatures = [...new Set(mapModules.flatMap((m) => Object.keys(mapping[m])))];
  const has = (list, x) => list.some((y) => norm(y) === norm(x));
  return {
    modulesNotInMapping: modules.filter((m) => !has(mapModules, m)),
    modulesNotInClickUp: mapModules.filter((m) => !has(modules, m)),
    featuresNotInMapping: features.filter((f) => !has(mapFeatures, f)),
    featuresNotInClickUp: mapFeatures.filter((f) => !has(features, f)),
  };
}
