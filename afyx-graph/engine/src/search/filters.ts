/**
 * Field-qualified search queries.
 *
 *     kind:function name:auth path:src/api authenticate
 *
 * splits into structured filters plus the remaining free text. Filters of the
 * same field are alternatives (OR); different fields narrow together (AND).
 *
 *   kind:   an exact node kind                       lang: / language:  a language id (any case)
 *   path:   substring of the file path               name:              substring of the symbol name
 *
 * A field prefix that is unknown, has an unrecognised kind/language value or an
 * empty value is ordinary text. Double quotes keep whitespace inside one token
 * (`path:"my dir/file"`); an unterminated quote swallows the rest of the input.
 * Parsing never throws.
 */

import { NODE_KINDS, LANGUAGES } from '../types';
import type { NodeKind, Language } from '../types';

export interface ParsedQuery {
  /** Free-text remainder for full-text search; may be empty. */
  text: string;
  kinds: NodeKind[];
  languages: Language[];
  /** Case-insensitive substrings of the file path. */
  pathFilters: string[];
  /** Case-insensitive substrings of the symbol name. */
  nameFilters: string[];
}

const KINDS: ReadonlySet<string> = new Set<string>(NODE_KINDS);
const LANGUAGE_IDS: ReadonlySet<string> = new Set<string>(LANGUAGES);

/** A token is plain characters and complete "quoted spans"; a lone quote runs to the end of input. */
const TOKEN = /(?:[^\s"]|"[^"]*")+(?:"[\s\S]*)?|"[\s\S]*/g;

const stripQuotes = (value: string): string =>
  value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;

/** Applies one field filter; returns false when the token should stay free text. */
type FieldHandler = (value: string, into: ParsedQuery) => boolean;

const kindHandler: FieldHandler = (value, into) => {
  if (!KINDS.has(value)) return false;
  into.kinds.push(value as NodeKind);
  return true;
};

const languageHandler: FieldHandler = (value, into) => {
  const id = value.toLowerCase();
  if (!LANGUAGE_IDS.has(id)) return false;
  into.languages.push(id as Language);
  return true;
};

// A Map (not an object) so keys like "constructor" or "__proto__" can never resolve to a handler.
const HANDLERS: ReadonlyMap<string, FieldHandler> = new Map<string, FieldHandler>([
  ['kind', kindHandler],
  ['lang', languageHandler],
  ['language', languageHandler],
  ['path', (value, into) => { into.pathFilters.push(value); return true; }],
  ['name', (value, into) => { into.nameFilters.push(value); return true; }],
]);

export function parseQuery(raw: string): ParsedQuery {
  const parsed: ParsedQuery = { text: '', kinds: [], languages: [], pathFilters: [], nameFilters: [] };
  const freeText: string[] = [];

  for (const token of raw.match(TOKEN) ?? []) {
    const colon = token.indexOf(':');
    const isField = colon > 0 && colon < token.length - 1;
    const value = isField ? stripQuotes(token.slice(colon + 1)) : '';
    const handler = isField && value ? HANDLERS.get(token.slice(0, colon).toLowerCase()) : undefined;
    if (!handler || !handler(value, parsed)) freeText.push(token);
  }

  parsed.text = freeText.join(' ').trim();
  return parsed;
}
