/**
 * Branch guards — the conditions under which a call site runs.
 *
 * An edge says `handlePress → openObjectDetail`. What a reader wants to know
 * is that it happens **when `isCollected`** and **not while `isUploading`**:
 *
 *   if (isUploading) return            ← early-return guard: !isUploading
 *   if (isCollected) {                 ← if: isCollected
 *     openObjectDetail(item)           ← the call site
 *
 * This module derives that from the AST at query time. Given a file, its
 * language and a call site (line, column), it walks from the innermost node at
 * that position up to the enclosing function boundary and records every
 * branch it passes through: `if` / `else` / `else if`, the arms of a ternary,
 * `switch` cases, the right side of `&&` / `||`, a `catch`, and — at each
 * statement block on the way — the early exits that precede the site
 * (`if (x) return`, Swift `guard x else { return }`).
 *
 * Nothing is stored in the index. The viewer and `afyx_graph_explore` already
 * re-read source per request (drift checks, source windows, highlighting), the
 * grammars are loaded in both processes, and a file parses in about a
 * millisecond — so labels are computed where they are shown, from the source
 * as it is now, and the index schema and the native kernel are untouched. A
 * small LRU keeps the last few parsed trees so a Symbol view that asks about
 * forty call sites in one file parses it once.
 *
 * Only what the AST states is reported. Loops are not conditions and are not
 * listed; a condition that cannot be read (a language without rules here, a
 * file that will not parse) yields no label rather than a wrong one.
 */

import * as fs from 'fs';
import type { Node as SyntaxNode, Tree } from 'web-tree-sitter';
import type { Language } from '../types';
import { getParser, loadGrammarsForLanguages } from '../extraction/grammars';
import {
  BRANCH_GUARD_LANGUAGES,
  branchForkKey,
  branchNodeIsField,
  branchWalkProfile,
  guardsInTree,
  supportsBranchGuards,
  type BranchGuard,
} from './branch-guard-policy';
import { createNativeBranchGuardReader, nativeGuardsInSource, supportsNativeBranchGuards } from './native-branch-guards';

export {
  BRANCH_GUARD_LANGUAGES,
  guardLabel,
  guardsInTree,
  supportsBranchGuards,
  type BranchGuard,
  type GuardExit,
  type GuardForm,
} from './branch-guard-policy';

// =============================================================================
// Public guard facade
// =============================================================================

const JS_FAMILY: ReadonlySet<Language> = new Set(['typescript', 'javascript', 'tsx', 'jsx']);

// =============================================================================
// Trees, cached per file version
// =============================================================================

interface CachedTree {
  key: string;
  tree: Tree;
  source: string;
}

const TREE_CACHE_SIZE = 8;
const treeCache = new Map<string, CachedTree>();

/**
 * Files above this size are not parsed for labels. A 300 KB source file costs
 * tens of milliseconds to parse, and a Symbol view is budgeted at 100 ms end
 * to end; a call site in such a file simply shows no `when`.
 */
export const MAX_PARSE_BYTES = 256 * 1024;

/** The `web-tree-sitter` trees held above are native memory: evict explicitly. */
function remember(path: string, entry: CachedTree): void {
  const old = treeCache.get(path);
  if (old) old.tree.delete();
  treeCache.delete(path);
  treeCache.set(path, entry);
  if (treeCache.size > TREE_CACHE_SIZE) {
    const oldest = treeCache.keys().next().value as string;
    treeCache.get(oldest)?.tree.delete();
    treeCache.delete(oldest);
  }
}

async function treeFor(absPath: string, language: Language): Promise<CachedTree | null> {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return null;
  }
  const key = `${language}:${stat.mtimeMs}:${stat.size}`;
  const hit = treeCache.get(absPath);
  if (hit && hit.key === key) return hit;
  if (stat.size > MAX_PARSE_BYTES) return null;
  let source: string;
  try {
    source = fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
  const tree = await parse(source, language);
  if (!tree) return null;
  const entry = { key, tree, source };
  remember(absPath, entry);
  return entry;
}

async function parse(source: string, language: Language): Promise<Tree | null> {
  try {
    await loadGrammarsForLanguages([language]);
    const parser = getParser(language);
    if (!parser) return null;
    return parser.parse(source) ?? null;
  } catch {
    return null;
  }
}

// =============================================================================
// Entry points
// =============================================================================

export interface CallSite {
  line: number;
  /** 0-based; null/undefined = the first non-blank column of the line. */
  column?: number | null;
  /**
   * The callee's last segment, when known (`json` for `res.status(201).json(…)`):
   * a position at the start of a chain sits on the innermost call, and the
   * climb continues to the call that is actually this one.
   */
  callee?: string;
}

export function siteKey(site: CallSite): string {
  return `${site.line}:${typeof site.column === 'number' ? site.column : ''}${site.callee ? `:${site.callee}` : ''}`;
}

/**
 * Guards for many call sites in one file, keyed by {@link siteKey}. The file
 * is parsed once (and cached across requests until it changes on disk). A
 * language without rules, or a file that cannot be read or parsed, yields an
 * empty map.
 */
export async function guardsForFile(
  absPath: string,
  language: Language,
  sites: readonly CallSite[]
): Promise<Map<string, BranchGuard[]>> {
  const out = new Map<string, BranchGuard[]>();
  if (!supportsBranchGuards(language) || sites.length === 0) return out;
  if (process.env.AFYX_GRAPH_NATIVE_PARSER === '1' && supportsNativeBranchGuards(language)) {
    let source: string;
    try {
      if (fs.statSync(absPath).size > MAX_PARSE_BYTES) return out;
      source = fs.readFileSync(absPath, 'utf8');
    } catch {
      return out;
    }
    const readGuards = createNativeBranchGuardReader(source, language);
    for (const site of sites) {
      const key = siteKey(site);
      if (!out.has(key)) out.set(key, readGuards(site.line, site.column ?? null));
    }
    return out;
  }
  const cached = await treeFor(absPath, language);
  if (!cached) return out;
  for (const site of sites) {
    const key = siteKey(site);
    if (out.has(key)) continue;
    out.set(key, guardsInTree(cached.tree.rootNode, cached.source, language, site.line, site.column ?? null));
  }
  return out;
}

/**
 * Synchronous twin of {@link guardsForFile} for callers that cannot await
 * (the explore text builder). It only serves languages whose grammar is
 * ALREADY loaded — see {@link warmBranchGuardGrammars} — and yields an empty
 * map otherwise, never a wrong label.
 */
export function guardsForFileSync(
  absPath: string,
  language: Language,
  sites: readonly CallSite[]
): Map<string, BranchGuard[]> {
  const out = new Map<string, BranchGuard[]>();
  if (!supportsBranchGuards(language) || sites.length === 0) return out;
  if (process.env.AFYX_GRAPH_NATIVE_PARSER === '1' && supportsNativeBranchGuards(language)) {
    let source: string;
    try {
      if (fs.statSync(absPath).size > MAX_PARSE_BYTES) return out;
      source = fs.readFileSync(absPath, 'utf8');
    } catch {
      return out;
    }
    const readGuards = createNativeBranchGuardReader(source, language);
    for (const site of sites) {
      const key = siteKey(site);
      if (!out.has(key)) out.set(key, readGuards(site.line, site.column ?? null));
    }
    return out;
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return out;
  }
  const key = `${language}:${stat.mtimeMs}:${stat.size}`;
  let cached = treeCache.get(absPath);
  if (!cached || cached.key !== key) {
    if (stat.size > MAX_PARSE_BYTES) return out;
    const parser = getParser(language);
    if (!parser) return out;
    let source: string;
    try {
      source = fs.readFileSync(absPath, 'utf8');
    } catch {
      return out;
    }
    const tree = parser.parse(source);
    if (!tree) return out;
    cached = { key, tree, source };
    remember(absPath, cached);
  }
  for (const site of sites) {
    const k = siteKey(site);
    if (!out.has(k)) out.set(k, guardsInTree(cached.tree.rootNode, cached.source, language, site.line, site.column ?? null));
  }
  return out;
}

// =============================================================================
// Call arguments — what a site passes
// =============================================================================

/** Longest argument list kept before it is cut with an ellipsis. */
const MAX_ARGS_TEXT = 96;
/** Longest single argument (a string literal, a name) kept whole. */
const MAX_ARG_TEXT = 40;
/** Object keys listed before `…` stands for the rest. */
const MAX_OBJECT_KEYS = 4;
/** Call nodes, across the grammars with rules here: JS, Swift, Python, Java, Kotlin, C#, Go, C. */
const CALL_TYPES: ReadonlySet<string> = new Set([
  'call_expression',
  'new_expression',
  'call',
  'method_invocation',
  'object_creation_expression',
  'invocation_expression',
  'constructor_invocation',
]);
const ARGUMENT_CONTAINERS: ReadonlySet<string> = new Set(['arguments', 'value_arguments', 'argument_list']);
const STRING_TYPES: ReadonlySet<string> = new Set([
  'string',
  'template_string',
  'line_string_literal',
  'multi_line_string_literal',
  'raw_string_literal',
  'string_literal',
  'interpreted_string_literal',
  'concatenated_string',
  'verbatim_string_literal',
  'interpolated_string_expression',
  'char_literal',
]);
const OBJECT_TYPES: ReadonlySet<string> = new Set(['object', 'object_expression', 'dictionary', 'anonymous_object_creation_expression']);
const ARRAY_TYPES: ReadonlySet<string> = new Set([
  'array',
  'array_literal',
  'dictionary_literal',
  'list',
  'tuple',
  'set',
  'list_comprehension',
  'array_creation_expression',
  'array_initializer',
  'initializer_list',
  'collection_expression',
  'collection_literal',
]);
const FUNCTION_TYPES: ReadonlySet<string> = new Set([
  'arrow_function',
  'function_expression',
  'function',
  'lambda',
  'lambda_expression',
  'func_literal',
  'anonymous_function',
  'anonymous_method_expression',
]);

/**
 * The arguments a call site passes, as written, abbreviated to what a reader
 * scans for: a string literal whole (a storage key, a URL, a message), a name
 * whole, an object as its keys (`{ email, password }`), an array as `[…]`, a
 * function as `() => …`, a nested call as `f(…)`. The conditions say WHEN a
 * step runs; this says WITH WHAT — `SecureStore.setItemAsync('userEmail',
 * values.email)` is a different fact from `SecureStore.setItemAsync`.
 *
 * Keyed by {@link siteKey} like the guards, read from the same cached tree.
 * A site that is not inside a call, or a language without rules, is absent.
 */
export async function callArgumentsForFile(
  absPath: string,
  language: Language,
  sites: readonly CallSite[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supportsBranchGuards(language) || sites.length === 0) return out;
  const cached = await treeFor(absPath, language);
  if (!cached) return out;
  for (const site of sites) {
    const key = siteKey(site);
    if (out.has(key)) continue;
    const text = callArgumentsInTree(cached.tree.rootNode, cached.source, site.line, site.column ?? null);
    if (text !== null) out.set(key, text);
  }
  return out;
}

/** {@link callArgumentsForFile} over source text — the test surface. */
export async function callArgumentsInSource(
  source: string,
  language: Language,
  line: number,
  column: number | null
): Promise<string | null> {
  if (!supportsBranchGuards(language)) return null;
  const tree = await parse(source, language);
  if (!tree) return null;
  try {
    return callArgumentsInTree(tree.rootNode, source, line, column);
  } finally {
    tree.delete();
  }
}

export function callArgumentsInTree(
  root: SyntaxNode,
  source: string,
  line: number,
  column: number | null
): string | null {
  return callSiteInTree(root, source, line, column)?.args ?? null;
}

/** One call site, both halves: what is called, as written, and what it is passed. */
export interface CallSiteText {
  /**
   * The callee as written, normalised: `prisma.article.findFirst`,
   * `this.owners.findById().orElseThrow`, `res.status().json` — member
   * chains kept whole (the index keeps only the last segment of a deep
   * chain), argument lists emptied, `await`/`new` dropped, `?.` as `.`.
   */
  callee: string;
  /** The argument list, abbreviated as {@link callArgumentsForFile} says. */
  args: string;
  /** The same arguments one by one — a registration site's middleware chain is `argList.slice(1, -1)`. */
  argList: string[];
  /** A status code written as an object property in the arguments (`{ status: 201 }`), which the abbreviation to keys would hide. */
  status?: number;
  /** Where the call starts and ends in the source (1-based lines) — the span another site may be written inside. */
  span?: { start: { line: number; column: number }; end: { line: number; column: number } };
  /**
   * The call this one is written inside the arguments of — `res.json` for the
   * `generateToken(…)` in `res.json({ token: generateToken(…) })` — normalised
   * like `callee`. Absent at the top of a statement, and never reaching out of
   * the function or block the call is in.
   */
  within?: string;
}

/** A node the climb to an enclosing call must not cross: the call is then a statement of its own inside a callback. */
const CALL_BOUNDARY = /function|lambda|closure|block|statement|body|declaration/;

/** The nearest call whose ARGUMENTS contain `call`, as its callee chain; null when there is none this side of a function or block. */
function enclosingCallText(call: SyntaxNode): string | null {
  for (let node = call.parent, up = 0; node && up < 12; node = node.parent, up++) {
    if (CALL_BOUNDARY.test(node.type)) return null;
    if (!CALL_TYPES.has(node.type)) continue;
    const container = argumentsOf(node);
    if (container && container.startIndex <= call.startIndex && call.endIndex <= container.endIndex) return calleeChainText(node, container);
    return null;
  }
  return null;
}

const STATUS_KEY = /^(?:status|statusCode|status_code|code)$/;

/** `{ status: 201 }` inside an argument — the literal an abbreviated object hides. */
function statusPropertyIn(node: SyntaxNode, depth = 0): number | null {
  if (depth > 2) return null;
  for (let i = 0; i < node.namedChildCount; i++) {
    const c = node.namedChild(i)!;
    if (c.type === 'pair' || c.type === 'keyword_argument' || c.type === 'named_argument' || c.type === 'property_assignment' || c.type === 'object_property') {
      const key = c.childForFieldName('key') ?? c.childForFieldName('name') ?? c.namedChild(0);
      const value = c.childForFieldName('value') ?? c.namedChild(c.namedChildCount - 1);
      if (key && value && STATUS_KEY.test(key.text.replace(/['"]/g, '')) && /^[1-5]\d{2}$/.test(value.text)) return Number(value.text);
    }
    const inner = statusPropertyIn(c, depth + 1);
    if (inner !== null) return inner;
  }
  return null;
}

/** Longest callee text kept before it is cut. */
const MAX_CALLEE_TEXT = 96;

/** The call node a site belongs to: climb from the callee to the call. A few levels cover a member chain. */
function callAt(root: SyntaxNode, source: string, line: number, column: number | null, callee?: string): SyntaxNode | null {
  const row = line - 1;
  // The recorded column may sit a character off the callee (a 1-based
  // column, the space before `prisma`): a near miss is tried before giving up.
  const columns = column === null ? [firstNonBlankColumn(source, row)] : [column, column + 1, Math.max(0, column - 1), firstNonBlankColumn(source, row)];
  const want = callee ? callee.split(/[.:]/).pop() ?? callee : null;
  for (const col of columns) {
    const start = innermostAt(root, row, col);
    if (!start) continue;
    let node: SyntaxNode | null = start;
    let first: SyntaxNode | null = null;
    for (let up = 0; node && up < 10; up++, node = node.parent) {
      if (!CALL_TYPES.has(node.type)) continue;
      if (!first) first = node;
      if (want === null) return node;
      // A chain's position is its start: `res.status(201).json(…)` at `res`
      // meets `res.status(…)` first; the call that is THIS one names `json`.
      const container = argumentsOf(node);
      const text = container ? calleeChainText(node, container) : '';
      if ((text.replace(/\([^()]*\)/g, '').split(/[.:]/).pop() ?? '') === want) return node;
    }
    if (first) return first;
  }
  return null;
}

export function callSiteInTree(root: SyntaxNode, source: string, line: number, column: number | null, want?: string): CallSiteText | null {
  const call = callAt(root, source, line, column, want);
  if (!call) return null;
  const container = argumentsOf(call);
  if (!container) return null;
  const callee = calleeChainText(call, container);
  if (container.type === 'lambda_literal') return { callee, args: '{ … }', argList: ['{ … }'] };
  const parts: string[] = [];
  let status: number | null = null;
  for (let i = 0; i < container.namedChildCount; i++) {
    const c = container.namedChild(i);
    if (!c || c.type === 'comment') continue;
    parts.push(abbreviateArgument(c, source));
    if (status === null && c.type !== 'comment') status = statusPropertyIn(c);
  }
  const text = parts.join(', ');
  if (status === null) status = statusSetBefore(call, callee);
  const span = {
    start: { line: call.startPosition.row + 1, column: call.startPosition.column },
    end: { line: call.endPosition.row + 1, column: call.endPosition.column },
  };
  const within = enclosingCallText(call);
  return {
    callee,
    args: text.length > MAX_ARGS_TEXT ? `${text.slice(0, MAX_ARGS_TEXT - 1)}…` : text,
    argList: parts,
    span,
    ...(within ? { within } : {}),
    ...(status !== null ? { status } : {}),
  };
}

const BODY_REPLY = /^(?:res|response|reply|rep|ctx|c|context)\.(?:json|jsonp|send|render|sendFile|download|end|text|html|body)$/;
const STATEMENT_BLOCKS: ReadonlySet<string> = new Set(['statement_block', 'program', 'block', 'class_body', 'module']);
/** Statements looked back through for a status the reply's own chain does not carry. */
const STATUS_LOOKBACK = 6;

/**
 * `res.status(202); res.json(user)` — the status set by an earlier statement
 * in the same block, when the reply's own chain sets none. Only a statement
 * that IS the status call counts (`res.status(404)` inside an `if` before it
 * is another path, not this reply's); the first one found walking back wins.
 */
function statusSetBefore(call: SyntaxNode, callee: string): number | null {
  const bare = callee.replace(/\([^()]*\)/g, '');
  if (!BODY_REPLY.test(bare) || /\b(?:status|code|sendStatus|writeHead)\(/.test(callee)) return null;
  const receiver = bare.split('.')[0]!;
  let statement: SyntaxNode | null = call;
  while (statement.parent && !STATEMENT_BLOCKS.has(statement.parent.type)) statement = statement.parent;
  const re = new RegExp(`^\\s*(?:await\\s+)?${receiver}\\s*\\.\\s*(?:status|code)\\s*\\(\\s*([1-5]\\d{2})\\s*\\)\\s*;?\\s*$|^\\s*${receiver}\\s*\\.\\s*statusCode\\s*=\\s*([1-5]\\d{2})\\s*;?\\s*$`);
  let prev: SyntaxNode | null = statement.previousNamedSibling;
  for (let i = 0; prev && i < STATUS_LOOKBACK; i++, prev = prev.previousNamedSibling) {
    if (prev.type === 'comment') continue;
    const m = re.exec(prev.text);
    if (m) return Number(m[1] ?? m[2]);
  }
  return null;
}

/** The text of a call before its arguments, normalised to a member chain. */
function calleeChainText(call: SyntaxNode, container: SyntaxNode): string {
  // Kotlin and Swift wrap the arguments in a `call_suffix`; the callee is
  // everything before that suffix.
  let end = container.startIndex;
  const suffix = container.parent && container.parent.type === 'call_suffix' ? container.parent : null;
  if (suffix) end = suffix.startIndex;
  let text = collapse(call.text.slice(0, Math.max(0, end - call.startIndex)));
  text = text.replace(/^(?:await|new|yield|return)\s+/, '').replace(/^(?:await|new)\s+/, '');
  // Empty every nested argument list, innermost first: `a(b(c)).d` → `a().d`
  // — keeping one short literal or name (`res.status(404).json`,
  // `ResponseEntity.status(HttpStatus.NOT_FOUND).body`), which is the fact a
  // reader of the chain wants.
  for (let i = 0; i < 6 && /\([^()]*\)/.test(text); i++) {
    text = text.replace(/\(([^()]*)\)/g, (_m, inner: string) => (/^\s*[\w.]{1,28}\s*$/.test(inner) ? `(${inner.trim()})` : '()'));
  }
  text = text
    .replace(/\?\./g, '.')
    .replace(/!\./g, '.')
    .replace(/\s+/g, '')
    .replace(/<[^<>]*>/g, '')
    .replace(/\([^()]*\)$/, '');
  return text.length > MAX_CALLEE_TEXT ? `${text.slice(0, MAX_CALLEE_TEXT - 1)}…` : text;
}

/** Both halves of every site, keyed by {@link siteKey}, from one cached tree. */
export async function callSitesForFile(
  absPath: string,
  language: Language,
  sites: readonly CallSite[]
): Promise<Map<string, CallSiteText>> {
  const out = new Map<string, CallSiteText>();
  if (!supportsBranchGuards(language) || sites.length === 0) return out;
  const cached = await treeFor(absPath, language);
  if (!cached) return out;
  for (const site of sites) {
    const key = siteKey(site);
    if (out.has(key)) continue;
    const found = callSiteInTree(cached.tree.rootNode, cached.source, site.line, site.column ?? null, site.callee);
    if (found !== null) out.set(key, found);
  }
  return out;
}

/** {@link callSitesForFile} over source text — the test surface. */
export async function callSiteInSource(
  source: string,
  language: Language,
  line: number,
  column: number | null
): Promise<CallSiteText | null> {
  if (!supportsBranchGuards(language)) return null;
  const tree = await parse(source, language);
  if (!tree) return null;
  try {
    return callSiteInTree(tree.rootNode, source, line, column);
  } finally {
    tree.delete();
  }
}

/** The node holding a call's arguments: the `arguments` field, a container child, or Swift's `call_suffix` contents. */
function argumentsOf(call: SyntaxNode): SyntaxNode | null {
  const field = call.childForFieldName('arguments');
  if (field) return field;
  for (let i = 0; i < call.namedChildCount; i++) {
    const c = call.namedChild(i);
    if (!c) continue;
    if (ARGUMENT_CONTAINERS.has(c.type)) return c;
    if (c.type === 'call_suffix') {
      for (let j = 0; j < c.namedChildCount; j++) {
        const inner = c.namedChild(j);
        if (inner && (ARGUMENT_CONTAINERS.has(inner.type) || inner.type === 'lambda_literal')) return inner;
      }
      return c;
    }
  }
  return null;
}

function abbreviateArgument(node: SyntaxNode, source: string): string {
  const type = node.type;
  // Python `name=value`, C# `name: value` — the name is half the meaning.
  if (type === 'keyword_argument') {
    const name = node.childForFieldName('name');
    const value = node.childForFieldName('value');
    return `${name?.text ?? ''}=${value ? abbreviateArgument(value, source) : ''}`;
  }
  if (type === 'argument') {
    // C#: an `argument` wraps the expression, optionally with a name.
    const name = node.childForFieldName('name');
    const inner = lastNamed(node);
    const value = inner ? abbreviateArgument(inner, source) : cut(collapse(node.text), MAX_ARG_TEXT);
    return name && inner && name.id !== inner.id ? `${name.text}: ${value}` : value;
  }
  // Go `gin.H{"error": err}` / `User{Name: n}`: the type, then the braces.
  if (type === 'composite_literal') {
    const t = node.childForFieldName('type');
    return `${t ? cut(collapse(t.text), 24) : ''}{…}`;
  }
  if (STRING_TYPES.has(type)) return cut(collapse(node.text), MAX_ARG_TEXT);
  if (OBJECT_TYPES.has(type)) return objectKeys(node, source);
  if (ARRAY_TYPES.has(type)) return '[…]';
  if (FUNCTION_TYPES.has(type)) return '() => …';
  if (type === 'lambda_literal') return '{ … }';
  if (type === 'spread_element') return cut(collapse(node.text), MAX_ARG_TEXT);
  if (type === 'await_expression') {
    const inner = node.namedChild(0);
    return inner ? `await ${abbreviateArgument(inner, source)}` : 'await …';
  }
  if (CALL_TYPES.has(type)) {
    const callee = node.childForFieldName('function') ?? node.childForFieldName('constructor') ?? node.namedChild(0);
    const name = callee ? cut(collapse(callee.text), 28) : '';
    return `${type === 'new_expression' ? 'new ' : ''}${name}(…)`;
  }
  // Swift `label: value` — the label is half the meaning (`withName:`).
  if (type === 'value_argument') {
    const named: SyntaxNode[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
      const c = node.namedChild(i);
      if (c) named.push(c);
    }
    if (named.length >= 2 && (named[0]!.type === 'simple_identifier' || named[0]!.type === 'value_argument_label')) {
      return `${named[0]!.text}: ${abbreviateArgument(named[named.length - 1]!, source)}`;
    }
    return named.length > 0 ? abbreviateArgument(named[named.length - 1]!, source) : cut(collapse(node.text), MAX_ARG_TEXT);
  }
  if (type === 'lambda_argument' || type === 'trailing_closure' || type === 'annotated_lambda') return '{ … }';
  return cut(collapse(node.text), MAX_ARG_TEXT);
}

/** `{ email, password, …}` — the keys an object literal passes, not its bulk. */
function objectKeys(node: SyntaxNode, source: string): string {
  const keys: string[] = [];
  let more = 0;
  for (let i = 0; i < node.namedChildCount; i++) {
    const c = node.namedChild(i);
    if (!c || c.type === 'comment') continue;
    let key: string | null = null;
    if (c.type === 'pair') key = c.childForFieldName('key')?.text ?? null;
    else if (c.type === 'shorthand_property_identifier' || c.type === 'shorthand_property_identifier_pattern') key = c.text;
    else if (c.type === 'spread_element') key = collapse(c.text);
    else if (c.type === 'method_definition') key = c.childForFieldName('name')?.text ?? null;
    if (key === null) continue;
    if (keys.length >= MAX_OBJECT_KEYS) {
      more++;
      continue;
    }
    keys.push(cut(key, 24));
  }
  void source;
  if (keys.length === 0) return '{…}';
  return `{ ${keys.join(', ')}${more > 0 ? ', …' : ''} }`;
}

// =============================================================================
// Triggers — what fires a site
// =============================================================================

/**
 * What binds a call site to an event, when something does — the answer to
 * "at what point does this run": the JSX attribute the site sits under
 * (`onPress` of `<Button>`), the `on*` option it is written in (`onSubmit`
 * of `useFormik({…})`), or the runs-later call it is an argument of
 * (`useEffect`, `setTimeout`, `addListener('x')`, `.then`).
 */
export interface SiteTrigger {
  /**
   * `prop` / `option` / `callback` are read at the site (below). `request`
   * (a route: `name` the verb, `of` the path), `decorator` (`@Process('email')`:
   * `name` the decorator, `of` its literal argument) and `load` (a page's own
   * load-time work) are set by the Steps endpoint from the registration
   * site, not read from the tree.
   */
  kind: 'prop' | 'option' | 'callback' | 'request' | 'decorator' | 'load';
  /** `onPress`, `onSubmit`, `useEffect`, `addListener`, `POST`, `Process`. */
  name: string;
  /** `Button` for a prop, `useFormik` for an option, the first string argument for a callback; null when unknown. */
  of: string | null;
  /** What runs before it fires — the middleware / guard chain at the registration site, in order. */
  after?: string[];
}

/** Callees whose function argument runs LATER — a callback, not a call. Matched on the last segment. */
const LATER_CALLEES: ReadonlySet<string> = new Set([
  'useEffect',
  'useLayoutEffect',
  'useFocusEffect',
  'useImperativeHandle',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'requestIdleCallback',
  'runAfterInteractions',
  'addListener',
  'addEventListener',
  'on',
  'once',
  'subscribe',
  'then',
  'catch',
  'finally',
  'runOnJS',
  'runOnUI',
  'scheduleOnRN',
]);
/** The walk up never leaves the function the site belongs to — unless that function is inline. */
const TRIGGER_BOUNDARIES: ReadonlySet<string> = new Set(['function_declaration', 'method_definition', 'class_declaration', 'class_body', 'program']);
const MAX_TRIGGER_CLIMB = 24;

export async function triggersForFile(
  absPath: string,
  language: Language,
  sites: readonly CallSite[]
): Promise<Map<string, SiteTrigger>> {
  const out = new Map<string, SiteTrigger>();
  if (!JS_FAMILY.has(language) || sites.length === 0) return out;
  const cached = await treeFor(absPath, language);
  if (!cached) return out;
  for (const site of sites) {
    const key = siteKey(site);
    if (out.has(key)) continue;
    const t = triggerInTree(cached.tree.rootNode, cached.source, site.line, site.column ?? null);
    if (t !== null) out.set(key, t);
  }
  return out;
}

/** {@link triggersForFile} over source text — the test surface. */
export async function triggerInSource(
  source: string,
  language: Language,
  line: number,
  column: number | null
): Promise<SiteTrigger | null> {
  if (!JS_FAMILY.has(language)) return null;
  const tree = await parse(source, language);
  if (!tree) return null;
  try {
    return triggerInTree(tree.rootNode, source, line, column);
  } finally {
    tree.delete();
  }
}

export function triggerInTree(root: SyntaxNode, source: string, line: number, column: number | null): SiteTrigger | null {
  const row = line - 1;
  const col = column ?? firstNonBlankColumn(source, row);
  let node: SyntaxNode | null = innermostAt(root, row, col);
  let prev: SyntaxNode | null = null;
  // Whether the climb crossed an inline function: `onPress={() => go()}`
  // fires later, `behavior={isAndroid() ? 'a' : 'b'}` runs at render.
  let deferred = false;
  for (let up = 0; node && up < MAX_TRIGGER_CLIMB; up++, prev = node, node = node.parent) {
    const type = node.type;
    if (TRIGGER_BOUNDARIES.has(type)) return null;
    // A named handler is its own story: `const handleX = useCallback(() => …)`
    // binds a name, and whoever uses the name is the trigger of what is inside.
    if (type === 'arrow_function' || type === 'function_expression') {
      const p = node.parent;
      if (p?.type === 'variable_declarator') return null;
      if (p?.type === 'arguments' && p.parent) {
        const callee = lastSegment(calleeText(p.parent));
        if (callee === 'useCallback' || callee === 'useMemo' || callee === 'useEffectEvent' || callee === 'useEvent') return null;
      }
      deferred = true;
    }
    if (type === 'jsx_attribute') {
      const name = node.namedChild(0);
      const propName = name ? name.text : 'prop';
      // An event prop, or any prop given a function: fired later. A value
      // computed in the attribute (`behavior={isAndroid() ? …}`) is not.
      if (!deferred && !/^on[A-Z]/.test(propName)) return null;
      const element = node.parent;
      const tag = element ? element.childForFieldName('name') : null;
      return { kind: 'prop', name: propName, of: tag ? collapseText(tag.text) : null };
    }
    if (type === 'pair') {
      const key = node.childForFieldName('key');
      const keyText = key ? key.text.replace(/^['"`]|['"`]$/g, '') : '';
      if (/^on[A-Z]\w*$/.test(keyText)) {
        // `useFormik({ onSubmit: … })`, `Alert.alert(t, m, [{ onPress: … }])`:
        // the object — possibly inside an array — is an argument of a call.
        let holder: SyntaxNode | null = node.parent;
        for (let hop = 0; holder && hop < 4 && (holder.type === 'object' || holder.type === 'array' || holder.type === 'pair'); hop++) {
          holder = holder.parent;
        }
        const call = holder?.type === 'arguments' ? holder.parent : null;
        return { kind: 'option', name: keyText, of: call && CALL_TYPES.has(call.type) ? calleeText(call) : null };
      }
    }
    if (type === 'arguments' && node.parent && CALL_TYPES.has(node.parent.type) && prev !== null) {
      const callee = lastSegment(calleeText(node.parent));
      if (callee !== null && LATER_CALLEES.has(callee)) {
        const first = node.namedChild(0);
        const of = first && STRING_TYPES.has(first.type) ? cut(collapseText(first.text), MAX_ARG_TEXT) : null;
        return { kind: 'callback', name: callee, of };
      }
    }
  }
  return null;
}

/** A call's callee as written: `nativeEmitter.addListener`, `Alert.alert`, `useFormik`. */
function calleeText(call: SyntaxNode): string | null {
  const callee = call.childForFieldName('function') ?? call.childForFieldName('constructor');
  return callee ? cut(collapseText(callee.text), 40) : null;
}

/** The last segment of a callee: `nativeEmitter.addListener` → `addListener`. */
function lastSegment(text: string | null): string | null {
  if (text === null) return null;
  const m = text.match(/([A-Za-z_$][\w$]*)\s*$/);
  return m ? m[1]! : text;
}

function collapseText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function collapse(text: string): string {
  return collapseText(text);
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function firstNonBlankColumn(source: string, row: number): number {
  const line = source.split('\n')[row] ?? '';
  const m = line.match(/\S/);
  return m ? (m.index ?? 0) : 0;
}

/** Load the grammars {@link guardsForFileSync} needs; a no-op once loaded, never throws. */
export async function warmBranchGuardGrammars(only?: readonly Language[]): Promise<void> {
  const wanted = BRANCH_GUARD_LANGUAGES.filter((l) => !only || only.includes(l));
  if (wanted.length === 0) return;
  try {
    await loadGrammarsForLanguages(wanted);
  } catch {
    // Explore prints no `when` for that language; nothing else changes.
  }
}

/** Guards for one site in source text — the test seam; production reads files. */
export async function guardsInSource(
  source: string,
  language: Language,
  line: number,
  column: number | null = null
): Promise<BranchGuard[]> {
  if (!supportsBranchGuards(language)) return [];
  if (process.env.AFYX_GRAPH_NATIVE_PARSER === '1' && supportsNativeBranchGuards(language)) {
    return nativeGuardsInSource(source, language, line, column);
  }
  const tree = await parse(source, language);
  if (!tree) return [];
  try {
    return guardsInTree(tree.rootNode, source, language, line, column);
  } finally {
    tree.delete();
  }
}

/** Loops for one site in source text — the test seam; production reads files. */
export async function loopsInSource(source: string, language: Language, line: number, column: number | null = null): Promise<SiteLoop[]> {
  if (!supportsBranchGuards(language)) return [];
  const tree = await parse(source, language);
  if (!tree) return [];
  try {
    return loopsInTree(tree.rootNode, source, language, line, column);
  } finally {
    tree.delete();
  }
}

/** A loop a site is written inside: its header as written, and where the loop starts. */
export interface SiteLoop {
  /** `const item of items`, `i = 0; i < n; i++`, `queue.length > 0` — the header, without its keyword. */
  text: string;
  /** `each` for a `for` / `foreach` / `for … in`, `while` for a `while` / `do` / `repeat`. */
  kind: 'each' | 'while';
  /** Where the loop starts, `line:column` — the same identity a guard's `branch` carries. */
  branch: string;
}

/** Loop node types across the grammars with rules here. A type absent yields nothing, never a wrong label. */
const LOOP_TYPES: ReadonlyMap<string, 'each' | 'while'> = new Map([
  ['for_statement', 'each'],
  ['for_in_statement', 'each'],
  ['for_of_statement', 'each'],
  ['for_each_statement', 'each'],
  ['enhanced_for_statement', 'each'],
  ['foreach_statement', 'each'],
  ['for_range_loop', 'each'],
  ['for_expression', 'each'],
  ['while_statement', 'while'],
  ['while_expression', 'while'],
  ['do_statement', 'while'],
  ['do_while_statement', 'while'],
  ['repeat_while_statement', 'while'],
]);

/**
 * The loops a site is written inside, outermost first — what tells a reading in
 * the code's order that a run of calls happens once PER ITEM rather than once.
 * The climb is the guards' climb (the same boundaries, the same transparent
 * inline functions), so a callback's body is read in its own function and a
 * `.forEach` body under the loop it is written in.
 */
export function loopsInTree(root: SyntaxNode, source: string, language: Language, line: number, column: number | null): SiteLoop[] {
  const rules = branchWalkProfile(language);
  if (!rules) return [];
  const row = line - 1;
  if (row < 0) return [];
  let col = column ?? 0;
  if (column === null) {
    const text = source.split('\n')[row] ?? '';
    const first = text.search(/\S/);
    col = first < 0 ? 0 : first;
  }
  let node: SyntaxNode | null = innermostAt(root, row, col);
  if (!node) return [];
  const found: SiteLoop[] = [];
  while (node) {
    const parent: SyntaxNode | null = node.parent;
    if (!parent || rules.boundaries.has(parent.type)) break;
    if (rules.inlineFunctions.has(parent.type)) {
      const holder = parent.parent?.type ?? '';
      if (rules.inlineBindings.has(holder)) break;
      node = parent;
      continue;
    }
    const kind = LOOP_TYPES.get(parent.type);
    // The header, not the body: a site is in the loop only when it is under it.
    if (kind && !branchNodeIsField(parent, 'condition', node) && !branchNodeIsField(parent, 'value', node)) {
      const text = loopHeader(parent);
      if (text) found.push({ text, kind, branch: branchForkKey(parent) });
    }
    node = parent;
  }
  found.reverse();
  return found;
}

/** Loops for many sites in one file, keyed by {@link siteKey}. */
export async function loopsForFile(absPath: string, language: Language, sites: readonly CallSite[]): Promise<Map<string, SiteLoop[]>> {
  const out = new Map<string, SiteLoop[]>();
  if (!supportsBranchGuards(language) || sites.length === 0) return out;
  const cached = await treeFor(absPath, language);
  if (!cached) return out;
  for (const site of sites) {
    const key = siteKey(site);
    if (!out.has(key)) out.set(key, loopsInTree(cached.tree.rootNode, cached.source, language, site.line, site.column ?? null));
  }
  return out;
}

/** A loop's header as written, keyword and braces dropped: `item of items`, `queue.length > 0`. */
function loopHeader(loop: SyntaxNode): string {
  const body = loop.childForFieldName('body') ?? namedChildren(loop).find((c) => BLOCKISH.has(c.type)) ?? null;
  const raw = body && body.startIndex > loop.startIndex ? loop.text.slice(0, body.startIndex - loop.startIndex) : loop.text;
  let text = raw.replace(/\s+/g, ' ').trim();
  text = text.replace(/^(?:for|foreach|while|do|repeat)\b\s*/i, '');
  text = text.replace(/[{:]\s*$/, '').trim();
  const inner = /^\((.*)\)$/s.exec(text);
  if (inner) text = inner[1]!.trim();
  // `const item of items` reads as `item of items`; the binding word is noise here.
  text = text.replace(/^(?:const|let|var|val|final)\s+/, '');
  return cut(text, 60);
}

/**
 * The innermost named node containing (row, col). `descendantForPosition` is
 * the fast path, but some grammars (Swift's `statements`) answer with the
 * container, so the result is refined by descending while a named child still
 * contains the point.
 */
function innermostAt(root: SyntaxNode, row: number, col: number): SyntaxNode | null {
  let node: SyntaxNode | null = root.descendantForPosition({ row, column: col });
  if (!node) return null;
  for (;;) {
    let next: SyntaxNode | null = null;
    const here: SyntaxNode = node;
    for (let i = 0; i < here.namedChildCount; i++) {
      const c: SyntaxNode = here.namedChild(i)!;
      const s = c.startPosition;
      const e = c.endPosition;
      const afterStart = s.row < row || (s.row === row && s.column <= col);
      const beforeEnd = e.row > row || (e.row === row && e.column > col);
      if (afterStart && beforeEnd) {
        next = c;
        break;
      }
    }
    if (!next) return node;
    node = next;
  }
}

// =============================================================================
// Shared AST helpers for call-site, loop, decorator and member-type families
// =============================================================================

const BLOCKISH: ReadonlySet<string> = new Set([
  'statement_block',
  'block',
  'statements',
  'function_body',
  'compound_statement',
  'control_structure_body',
  'else_clause',
  'else_statement',
  'catch_clause',
  'catch_block',
  'except_clause',
  'finally_clause',
]);

function lastNamed(node: SyntaxNode): SyntaxNode | null {
  return node.namedChildCount > 0 ? node.namedChild(node.namedChildCount - 1) : null;
}

function precedingSiblings(parent: SyntaxNode, child: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let i = 0; i < parent.namedChildCount; i++) {
    const sibling = parent.namedChild(i)!;
    if (sibling.id === child.id) break;
    out.push(sibling);
  }
  return out;
}

function namedChildren(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let i = 0; i < node.namedChildCount; i++) out.push(node.namedChild(i)!);
  return out;
}
// =============================================================================
// Decorators — what is written on a definition
// =============================================================================

/**
 * The decorators / annotations / attributes on the definition at a line, and
 * on the class that holds it: `UseGuards(AuthGuard('jwt'))`,
 * `PreAuthorize("hasRole('ADMIN')")`, `HttpPost("items")`, `Process('email')`.
 * Text as written, without the `@` or the brackets, whitespace collapsed,
 * capped. The index keeps no decorators, so they are read here at request
 * time like the guards.
 */
export interface DefinitionDecorators {
  own: string[];
  /** The enclosing class's, when the definition is a member. */
  class: string[];
}

const DEFINITION_TYPES: ReadonlySet<string> = new Set([
  'function_declaration',
  'function_definition',
  'method_definition',
  'method_declaration',
  'constructor_declaration',
  'class_declaration',
  'class_definition',
  'decorated_definition',
  'local_function_statement',
  'lexical_declaration',
  'variable_declaration',
  'public_field_definition',
]);
const CLASS_TYPES: ReadonlySet<string> = new Set(['class_declaration', 'class_definition', 'class', 'object_declaration', 'struct_declaration', 'record_declaration']);
const DECORATOR_TYPES: ReadonlySet<string> = new Set(['decorator', 'annotation', 'marker_annotation', 'attribute']);
const MAX_DECORATOR_TEXT = 80;

export async function decoratorsForFile(
  absPath: string,
  language: Language,
  lines: readonly number[]
): Promise<Map<number, DefinitionDecorators>> {
  const out = new Map<number, DefinitionDecorators>();
  if (!supportsBranchGuards(language) || lines.length === 0) return out;
  const cached = await treeFor(absPath, language);
  if (!cached) return out;
  for (const line of lines) {
    if (out.has(line)) continue;
    const found = decoratorsInTree(cached.tree.rootNode, cached.source, line);
    if (found !== null) out.set(line, found);
  }
  return out;
}

/** {@link decoratorsForFile} over source text — the test surface. */
export async function decoratorsInSource(source: string, language: Language, line: number): Promise<DefinitionDecorators | null> {
  if (!supportsBranchGuards(language)) return null;
  const tree = await parse(source, language);
  if (!tree) return null;
  try {
    return decoratorsInTree(tree.rootNode, source, line);
  } finally {
    tree.delete();
  }
}

export function decoratorsInTree(root: SyntaxNode, source: string, line: number): DefinitionDecorators | null {
  const row = line - 1;
  const col = firstNonBlankColumn(source, row);
  let node: SyntaxNode | null = innermostAt(root, row, col);
  if (!node) return null;
  // Up to the definition the line belongs to.
  let definition: SyntaxNode | null = null;
  for (let up = 0; node && up < 12; up++, node = node.parent) {
    if (DEFINITION_TYPES.has(node.type)) {
      definition = node;
      break;
    }
  }
  if (!definition) return null;
  // A Python decorated function is the child of the node that holds the decorators.
  const holder = definition.parent && definition.parent.type === 'decorated_definition' ? definition.parent : definition;
  const own = decoratorsOn(holder);
  let cls: SyntaxNode | null = holder.parent;
  for (let up = 0; cls && up < 6 && !CLASS_TYPES.has(cls.type); up++) cls = cls.parent;
  const clsHolder = cls && cls.parent && cls.parent.type === 'decorated_definition' ? cls.parent : cls;
  return { own, class: clsHolder ? decoratorsOn(clsHolder) : [] };
}

/** Decorator texts on one definition node: its own leading decorator children, its modifiers/attribute lists, or the siblings before it. */
function decoratorsOn(definition: SyntaxNode): string[] {
  const out: string[] = [];
  const add = (n: SyntaxNode) => {
    if (n.type === 'attribute_list') {
      for (const a of namedChildren(n)) if (a.type === 'attribute') out.push(decoratorText(a));
      return;
    }
    if (DECORATOR_TYPES.has(n.type)) out.push(decoratorText(n));
  };
  for (const c of namedChildren(definition)) {
    if (c.type === 'modifiers') for (const m of namedChildren(c)) add(m);
    else add(c);
  }
  // JS: decorators are siblings that precede the member in the class body.
  if (out.length === 0 && definition.parent) {
    const before = precedingSiblings(definition.parent, definition);
    for (let i = before.length - 1; i >= 0; i--) {
      const s = before[i]!;
      if (s.type !== 'decorator') break;
      out.unshift(decoratorText(s));
    }
  }
  return out;
}

function decoratorText(node: SyntaxNode): string {
  let text = collapse(node.text).replace(/^@\s*/, '');
  if (node.type === 'attribute_list') text = text.replace(/^\[|\]$/g, '');
  return cut(text, MAX_DECORATOR_TEXT);
}


// =============================================================================
// Member types — what a class declares its members to be
// =============================================================================

/**
 * The declared types of a class's members, read from the tree: the
 * constructor's parameter properties (`private readonly usersService:
 * UsersService`), its fields (`private final OwnerRepository owners`,
 * `val owners: OwnerRepository`, `private readonly IRepo _repo`), its typed
 * properties. The index keeps no type for these, and a member call the
 * extractor kept only the last segment of (`this.usersService.findByEmail`
 * → `findByEmail`) resolves by name alone; the declared type is what says
 * where it really goes, and whether it leaves the index.
 *
 * Keyed by member name, the type as written without generics'
 * arguments (`Repository<Cat>` → `Repository<Cat>` is kept whole; callers
 * strip what they need).
 */
export async function memberTypesForFile(absPath: string, language: Language, line: number): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!supportsBranchGuards(language)) return out;
  const cached = await treeFor(absPath, language);
  if (!cached) return out;
  return memberTypesInTree(cached.tree.rootNode, cached.source, line);
}

/** {@link memberTypesForFile} over source text — the test surface. */
export async function memberTypesInSource(source: string, language: Language, line: number): Promise<Map<string, string>> {
  if (!supportsBranchGuards(language)) return new Map();
  const tree = await parse(source, language);
  if (!tree) return new Map();
  try {
    return memberTypesInTree(tree.rootNode, source, line);
  } finally {
    tree.delete();
  }
}

const CLASS_BODY_TYPES: ReadonlySet<string> = new Set(['class_body', 'declaration_list', 'field_declaration_list']);

export function memberTypesInTree(root: SyntaxNode, source: string, line: number): Map<string, string> {
  const out = new Map<string, string>();
  const row = line - 1;
  let node: SyntaxNode | null = innermostAt(root, row, firstNonBlankColumn(source, row));
  let cls: SyntaxNode | null = null;
  for (let up = 0; node && up < 16; up++, node = node.parent) {
    if (CLASS_TYPES.has(node.type)) {
      cls = node;
      break;
    }
  }
  if (!cls) return out;
  const typeText = (n: SyntaxNode | null | undefined): string => (n ? collapse(n.text).replace(/^:\s*/, '').trim() : '');
  const put = (name: string | null | undefined, type: string) => {
    if (name && type && !out.has(name)) out.set(name, type);
  };
  const visitParams = (params: SyntaxNode | null) => {
    if (!params) return;
    for (const p of namedChildren(params)) {
      // TS: `private readonly x: T` (a parameter property); Kotlin: `val x: T`; C#/Java: `T x` — a field of the same name may follow.
      if (p.type === 'required_parameter' || p.type === 'optional_parameter') {
        if (!namedChildren(p).some((c) => c.type === 'accessibility_modifier' || c.type === 'override_modifier') && !/^\s*(?:public|private|protected|readonly)\b/.test(p.text)) continue;
        put(p.childForFieldName('pattern')?.text, typeText(p.childForFieldName('type')));
      } else if (p.type === 'class_parameter') {
        const kids = namedChildren(p);
        const name = kids.find((c) => c.type === 'simple_identifier');
        const type = kids.find((c) => c.type === 'user_type' || c.type === 'nullable_type');
        if (kids.some((c) => c.type === 'binding_pattern_kind')) put(name?.text, typeText(type));
      } else if (p.type === 'parameter' || p.type === 'formal_parameter') {
        put(p.childForFieldName('name')?.text, typeText(p.childForFieldName('type')));
      }
    }
  };
  // Kotlin's primary constructor sits on the class node itself.
  for (const c of namedChildren(cls)) if (c.type === 'primary_constructor') visitParams(namedChildren(c).find((n) => n.type === 'class_parameters') ?? c);
  const body = namedChildren(cls).find((c) => CLASS_BODY_TYPES.has(c.type)) ?? cls.childForFieldName('body');
  if (!body) return out;
  for (const m of namedChildren(body)) {
    switch (m.type) {
      case 'public_field_definition':
      case 'field_definition':
        put(m.childForFieldName('name')?.text, typeText(m.childForFieldName('type')));
        break;
      case 'method_definition':
        if (m.childForFieldName('name')?.text === 'constructor') visitParams(m.childForFieldName('parameters'));
        break;
      case 'field_declaration': {
        // Java: `type` + `declarator`; C#: a `variable_declaration` inside.
        const type = m.childForFieldName('type');
        if (type) {
          for (const d of namedChildren(m)) if (d.type === 'variable_declarator') put(d.childForFieldName('name')?.text, typeText(type));
        } else {
          const decl = namedChildren(m).find((c) => c.type === 'variable_declaration');
          const t = decl?.childForFieldName('type');
          for (const d of decl ? namedChildren(decl) : []) if (d.type === 'variable_declarator') put(d.childForFieldName('name')?.text, typeText(t));
        }
        break;
      }
      case 'property_declaration': {
        // C#: `type` + `name`; Kotlin: `variable_declaration (name) (type)`.
        const csType = m.childForFieldName('type');
        if (csType) put(m.childForFieldName('name')?.text, typeText(csType));
        else {
          const decl = namedChildren(m).find((c) => c.type === 'variable_declaration');
          const kids = decl ? namedChildren(decl) : [];
          const name = kids.find((c) => c.type === 'simple_identifier');
          const type = kids.find((c) => c.type === 'user_type' || c.type === 'nullable_type');
          put(name?.text, typeText(type));
        }
        break;
      }
      case 'constructor_declaration':
        visitParams(m.childForFieldName('parameters'));
        break;
      default:
        break;
    }
  }
  return out;
}
