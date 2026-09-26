/**
 * Names that identify the project itself.
 *
 * A project name in a query ("MyApp backend routes") is context, not a signal: when
 * it also appears in a path or symbol it inflates that part of the tree. The tokens
 * returned here let ranking ignore such words. They come from `go.mod`, the
 * `package.json` name (scope removed) and the root directory name, normalized to
 * lowercase alphanumerics; only names of at least five characters qualify, because
 * shorter ones (`api`, `core`, `web`) collide with real query words.
 */

import * as fs from 'fs';
import * as path from 'path';

const MIN_PROJECT_TOKEN = 5;

/** Lowercase alphanumerics only: the comparable form of a name. */
export function normalizeNameToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readOptional(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch {
    return null;
  }
}

function goModuleName(root: string): string | undefined {
  const manifest = readOptional(path.join(root, 'go.mod'));
  const modulePath = manifest?.match(/^\s*module\s+(\S+)/m)?.[1];
  return modulePath?.split('/').pop();
}

function packageName(root: string): string | undefined {
  const manifest = readOptional(path.join(root, 'package.json'));
  if (manifest === null) return undefined;
  try {
    const name: unknown = JSON.parse(manifest).name;
    return typeof name === 'string' ? name.replace(/^@[^/]+\//, '') : undefined;
  } catch {
    return undefined;
  }
}

export function deriveProjectNameTokens(projectRoot: string): Set<string> {
  const sources = [goModuleName(projectRoot), packageName(projectRoot), path.basename(path.resolve(projectRoot))];
  const tokens = new Set<string>();
  for (const source of sources) {
    const token = source ? normalizeNameToken(source) : '';
    if (token.length >= MIN_PROJECT_TOKEN) tokens.add(token);
  }
  return tokens;
}
