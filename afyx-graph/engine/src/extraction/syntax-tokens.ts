/**
 * Syntax classification from the engine's own tree-sitter parse (CG-57).
 *
 * The viewer used to run a second highlighter (Shiki + 56 pruned TextMate
 * grammars) over source the engine had already parsed with a real grammar. This
 * takes the classification off the tree instead, which removes the second
 * dependency, the second grammar set, and — the part that actually mattered —
 * the second opinion: a `.ts` file is now read by exactly the grammar that
 * decided what its symbols are.
 *
 * ## What comes out
 *
 * A flat, ordered, non-overlapping list of {@link SyntaxSpan}s over the source
 * string. Gaps between spans are whitespace and are the caller's to fill. The
 * classes are deliberately few, because the design's code colouring is
 * near-monochrome: comments recede, strings and numbers recede one step less,
 * keywords carry weight rather than hue, and the only colour in the body is a
 * call site the graph resolved.
 *
 * ## How a node becomes a class
 *
 * The rules are language-agnostic on purpose — the engine indexes 40-odd
 * languages and a per-grammar scope table would be 40 tables to keep true:
 *
 * * a node whose type mentions `comment` is a comment, whole, undescended;
 * * inside a string node every leaf is string, *except* below an interpolation,
 *   where the code starts again (so `${user.name()}` still links);
 * * a numeric literal node is a number;
 * * an **anonymous** leaf is a keyword when its text is a bare word and
 *   punctuation otherwise — this is what makes `func`, `fn`, `def`, `END-IF`
 *   and `Sub` all land as keywords without naming any of them;
 * * a **named** leaf whose text is identifier-shaped is an identifier, unless
 *   the grammar called it a type name, or the extractor's own definition tables
 *   say it is the name of a definition.
 *
 * The last of those is the one place per-language knowledge is used, and it is
 * reused rather than restated: {@link EXTRACTORS} already names every node type
 * that declares something in each language, plus the field its name hangs on.
 */

import type { Node as SyntaxNode } from 'web-tree-sitter';
import { Language } from '../types';
import { EXTRACTORS } from './languages';
import { getParser, loadGrammarsForLanguages } from './grammars';
import type { LanguageExtractor } from './tree-sitter-types';
import { extractNativeFacts } from './native/fact-extractor';
import { scanSource, type NativeToken } from './native/scanner';

/* ------------------------------------------------------------- the classes -- */

/**
 * Every class a token can carry, in wire order.
 *
 * `other` is punctuation and whitespace both. The design spec lists them apart
 * (`punct` vs the gaps) but they paint identically — plain ink — and splitting
 * them would roughly double the token count on a dense line to express a
 * difference nothing draws.
 */
export const SYNTAX_TOKEN_CLASSES = [
  'other',
  'ident',
  'comment',
  'string',
  'keyword',
  'number',
  'type',
  'def',
] as const;

export type SyntaxTokenClass = (typeof SYNTAX_TOKEN_CLASSES)[number];

/** A classified run of the source, by JS string index. Half-open. */
export interface SyntaxSpan {
  start: number;
  end: number;
  cls: SyntaxTokenClass;
}

/* ---------------------------------------------------------- node-type tests -- */

/**
 * Anything a grammar calls a comment.
 *
 * Substring rather than equality because the spelling is per-grammar:
 * `comment`, `line_comment`, `block_comment`, `doc_comment`, `html_comment`,
 * `comment_directive`, `preproc_comment`.
 */
function isCommentType(type: string): boolean {
  return type.includes('comment');
}

/**
 * A node whose leaves are string content unless an interpolation interrupts.
 *
 * `string` covers the bulk (`string_literal`, `interpreted_string_literal`,
 * `raw_string_literal`, `encapsed_string`, `string_content`); the rest are the
 * spellings that avoid the word — Rust/Go/C character literals, shell and PHP
 * heredocs, and regular expressions, which recede for the same reason a string
 * does.
 */
function isStringType(type: string): boolean {
  return (
    type.includes('string') ||
    type.includes('heredoc') ||
    type.includes('regex') ||
    type === 'char_literal' ||
    type === 'character' ||
    type === 'character_literal' ||
    type === 'rune_literal' ||
    type === 'quoted_attribute_value'
  );
}

/**
 * Where code resumes inside a string.
 *
 * A template literal's `${…}` and an f-string's `{…}` hold real expressions,
 * and the graph records call sites inside them. Swallowing the whole literal as
 * one string token would drop those links — the overlay refuses to claim a
 * token classed `string`, deliberately, so that a word inside a message never
 * gets underlined.
 */
function isInterpolationType(type: string): boolean {
  return (
    type.includes('interpolation') ||
    type.includes('substitution') ||
    type === 'template_substitution' ||
    type === 'string_interpolation' ||
    type === 'format_expression'
  );
}

/** A numeric literal, plus the language constants a theme groups with them. */
function isNumberType(type: string): boolean {
  return (
    type === 'number' ||
    type === 'integer' ||
    type === 'float' ||
    type === 'number_literal' ||
    type === 'integer_literal' ||
    type === 'float_literal' ||
    type === 'decimal_integer_literal' ||
    type === 'decimal_floating_point_literal' ||
    type === 'hex_integer_literal' ||
    type === 'real_literal' ||
    type === 'numeric_literal' ||
    type === 'int_literal' ||
    type === 'imaginary_literal'
  );
}

/** A named type reference — `type_identifier` and the equivalents. */
function isTypeNameType(type: string): boolean {
  return type.includes('type_identifier') || type === 'type_name' || type === 'class_type';
}

/**
 * Built-in type words — `string`, `int`, `u32`, `void`.
 *
 * These are emitted WHOLE and undescended, and they carry the same `type` class
 * a user-defined type name gets. Both halves of that matter, because the
 * grammars disagree with each other about what a built-in type even is:
 * tree-sitter-go calls `string` a `type_identifier` (so it would be a type),
 * tree-sitter-typescript wraps it in a `predefined_type` whose child is an
 * anonymous token spelled `string` (so it would be a keyword). Reading the
 * wrapper rather than its children is what stops the same word from painting
 * two different ways in two languages on the same screen.
 */
const BUILTIN_TYPE_TYPES: ReadonlySet<string> = new Set([
  'primitive_type',
  'predefined_type',
  'builtin_type',
  'sized_type_specifier',
]);

/** Literal constants a theme groups with numbers (`constant.language`). */
const CONSTANT_TYPES: ReadonlySet<string> = new Set([
  'true',
  'false',
  'null',
  'nil',
  'none',
  'undefined',
  'null_literal',
  'nil_literal',
  'boolean_literal',
  'true_literal',
  'false_literal',
]);

/**
 * Identifier-shaped text, in the loosest sense every indexed language agrees on.
 *
 * The high range is there because `\w` is ASCII-only in JavaScript and a symbol
 * name can be Chinese, Japanese or Cyrillic; a call site in those repositories
 * has to be linkable too. Hyphens are in because COBOL and Erlang spell words
 * with them (`END-IF`, `is_record`).
 */
const IDENT_SHAPE = /^[A-Za-z_$À-￿][\w$À-￿-]*$/;

/** A bare word — what separates a keyword from punctuation among anonymous nodes. */
const WORD_SHAPE = /^[A-Za-z_][A-Za-z_0-9-]*$/;

/* ------------------------------------------------------- definition names -- */

/**
 * Every node type that declares something, per language, from the extractors.
 *
 * This is the single piece of per-language knowledge the classifier uses, and
 * it is borrowed rather than restated: the same lists drive extraction, so a
 * language that learns a new declaration form gets its name bolded here for
 * free — and cannot drift, because there is only one list.
 */
function definitionTypesFor(extractor: LanguageExtractor): ReadonlySet<string> {
  return new Set([
    ...extractor.functionTypes,
    ...extractor.classTypes,
    ...extractor.methodTypes,
    ...extractor.interfaceTypes,
    ...extractor.structTypes,
    ...extractor.enumTypes,
    ...extractor.typeAliasTypes,
    ...(extractor.unionTypes ?? []),
    ...(extractor.extraClassNodeTypes ?? []),
  ]);
}

/* ------------------------------------------------------------- the walker -- */

interface WalkContext {
  source: string;
  out: SyntaxSpan[];
  defTypes: ReadonlySet<string>;
  nameField: string;
  /** Start indices of nodes that are a definition's own name. */
  defStarts: Set<number>;
  offset: number;
}

/**
 * Classify one parsed tree into spans.
 *
 * Exported for tests and for anything that already holds a tree; the usual
 * entry point is {@link tokenizeSource}, which parses first.
 */
export function classifyTree(
  root: SyntaxNode,
  source: string,
  language: Language,
  offset = 0
): SyntaxSpan[] {
  const extractor = EXTRACTORS[language];
  const ctx: WalkContext = {
    source,
    out: [],
    defTypes: extractor ? definitionTypesFor(extractor) : new Set<string>(),
    nameField: extractor?.nameField ?? 'name',
    defStarts: new Set<number>(),
    offset,
  };
  visit(root, ctx, false);
  return ctx.out;
}

function visit(node: SyntaxNode, ctx: WalkContext, inString: boolean): void {
  const type = node.type;

  if (node.isNamed && isCommentType(type)) {
    emit(ctx, node.startIndex, node.endIndex, 'comment');
    return;
  }

  if (node.isNamed && BUILTIN_TYPE_TYPES.has(type)) {
    emit(ctx, node.startIndex, node.endIndex, 'type');
    return;
  }

  // Record the definition's own name BEFORE descending — the name node is a
  // descendant, so the mark has to be in place by the time the walk reaches it.
  if (ctx.defTypes.has(type)) {
    const name = node.childForFieldName(ctx.nameField);
    if (name) ctx.defStarts.add(name.startIndex);
  }

  const childCount = node.childCount;
  if (childCount === 0) {
    emit(ctx, node.startIndex, node.endIndex, leafClass(node, ctx, inString));
    return;
  }

  const nested = isInterpolationType(type) ? false : inString || isStringType(type);

  for (let i = 0; i < childCount; i++) {
    const child = node.child(i);
    if (child) visit(child, ctx, nested);
  }
}

function leafClass(node: SyntaxNode, ctx: WalkContext, inString: boolean): SyntaxTokenClass {
  const type = node.type;

  // An ANONYMOUS node's `type` is its own literal text, so none of the
  // type-name tests below may be applied to one: `key: string` in TypeScript or
  // PHP is a token whose type is the word `string`, and reading that as a
  // string literal greys out half of every signature. Anonymous means keyword
  // or punctuation, decided on shape alone — which is also what makes `func`,
  // `fn`, `def`, `Sub` and `END-IF` all land right without naming any of them.
  if (!node.isNamed) {
    if (inString) return 'string';
    if (CONSTANT_TYPES.has(type)) return 'number';
    return WORD_SHAPE.test(type) ? 'keyword' : 'other';
  }

  if (inString || isStringType(type)) return 'string';
  if (isNumberType(type) || CONSTANT_TYPES.has(type)) return 'number';

  const text = ctx.source.slice(node.startIndex, node.endIndex);
  // Ahead of the type tests: a class name is a `type_identifier` in half these
  // grammars and a plain `identifier` in the other half, and the design bolds
  // the thing being DECLARED either way.
  if (ctx.defStarts.has(node.startIndex) && IDENT_SHAPE.test(text)) return 'def';
  if (isTypeNameType(type)) return 'type';
  return IDENT_SHAPE.test(text) ? 'ident' : 'other';
}

/**
 * Append a span, skipping empties and merging a run of the same class.
 *
 * Zero-width nodes are real: every grammar with a layout-sensitive scanner
 * (Python's `_newline`, Erlang's, Swift's) emits them, and a zero-width span
 * would put an empty token on the wire for nothing.
 */
function emit(ctx: WalkContext, start: number, end: number, cls: SyntaxTokenClass): void {
  if (end <= start) return;
  const last = ctx.out[ctx.out.length - 1];
  const from = start + ctx.offset;
  if (last && last.cls === cls && last.end === from) {
    last.end = end + ctx.offset;
    return;
  }
  ctx.out.push({ start: from, end: end + ctx.offset, cls });
}

/* --------------------------------------------------------------- regions -- */

/**
 * A stretch of a file written in a different language from the file itself.
 *
 * Single-file components are the only case: a `.svelte`, `.vue` or `.astro`
 * file has no tree-sitter grammar of its own here, but its `<script>` block —
 * where every symbol the engine indexed in that file lives — is ordinary
 * TypeScript or JavaScript. The extractors already delegate exactly this way,
 * so the viewer reads a component's code with the same grammar the graph was
 * built from. The surrounding markup stays unclassified, which under a
 * near-monochrome theme costs the recession on tag names and attribute strings
 * and nothing else.
 */
export interface SyntaxRegion {
  start: number;
  end: number;
  language: Language;
}

const SCRIPT_BLOCK = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const TS_LANG_ATTR = /lang\s*=\s*["'](ts|typescript)["']/i;
/** Astro's frontmatter: a `---` fence at the very top of the file. */
const ASTRO_FRONTMATTER = /^(---\r?\n)([\s\S]*?)\r?\n---/;

/**
 * The sub-language regions of a file, or null when the file is one language.
 *
 * Null and an empty array mean different things: null is "parse the whole file
 * as `language`", empty is "this file has a grammar for none of it".
 */
export function syntaxRegionsFor(source: string, language: Language): SyntaxRegion[] | null {
  if (language !== 'svelte' && language !== 'vue' && language !== 'astro') return null;

  const regions: SyntaxRegion[] = [];
  if (language === 'astro') {
    const front = ASTRO_FRONTMATTER.exec(source);
    if (front && front[2]) {
      const start = (front[1] as string).length;
      regions.push({ start, end: start + (front[2] as string).length, language: 'typescript' });
    }
  }

  SCRIPT_BLOCK.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SCRIPT_BLOCK.exec(source)) !== null) {
    const body = match[2] ?? '';
    if (body.trim() === '') continue;
    const start = match.index + match[0].length - body.length - '</script>'.length;
    regions.push({
      start,
      end: start + body.length,
      language: TS_LANG_ATTR.test(match[1] ?? '') ? 'typescript' : 'javascript',
    });
  }
  return regions;
}

/* --------------------------------------------------------------- the API -- */

export interface TokenizeResult {
  spans: SyntaxSpan[];
  /** The grammar(s) that produced them, for the payload's `grammar` field. */
  grammars: string[];
}

const NATIVE_SYNTAX_LANGUAGES: ReadonlySet<Language> = new Set([
  'typescript', 'tsx', 'javascript', 'jsx', 'python', 'go', 'java', 'rust', 'kotlin', 'scala',
  'c', 'cpp', 'objc', 'csharp',
]);

const NATIVE_KEYWORDS: Readonly<Record<string, ReadonlySet<string>>> = {
  typescript: new Set('as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of package private protected public readonly return set static super switch this throw true try type typeof undefined var void while with yield'.split(' ')),
  javascript: new Set('as async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof undefined var void while with yield'.split(' ')),
  python: new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' ')),
  go: new Set('break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var'.split(' ')),
  java: new Set('abstract assert boolean break byte case catch char class const continue default do double else enum exports extends final finally float for goto if implements import instanceof int interface long module native new non-sealed null open opens package permits private protected provides public record requires return sealed short static strictfp super switch synchronized this throw throws to transient transitive true try uses var void volatile while with yield false'.split(' ')),
  rust: new Set('as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while union'.split(' ')),
  kotlin: new Set('as break class continue do else false for fun if in interface is null object package return super this throw true try typealias typeof val var when while by catch constructor delegate dynamic field file finally get import init param property receiver set setparam where actual abstract annotation companion const crossinline data enum expect external final infix inline inner internal lateinit noinline open operator out override private protected public reified sealed suspend tailrec vararg'.split(' ')),
  scala: new Set('abstract case catch class def do else enum export extends false final finally for forSome given if implicit import lazy match new null object opaque open override package private protected return sealed super then this throw trait transparent true try type val var while with yield extension inline using end derives'.split(' ')),
  c: new Set('auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while'.split(' ')),
  cpp: new Set('alignas alignof and and_eq asm auto bitand bitor bool break case catch char class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not nullptr operator or override private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile while xor'.split(' ')),
  objc: new Set('auto break case char const continue default do double else enum extern float for goto if inline int long register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while interface implementation protocol property end selector'.split(' ')),
  csharp: new Set('abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params partial private protected public readonly record ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while yield'.split(' ')),
};

const NATIVE_BUILTIN_TYPES: Readonly<Record<string, ReadonlySet<string>>> = {
  typescript: new Set('any bigint boolean never number object string symbol unknown void'.split(' ')),
  javascript: new Set(),
  python: new Set(),
  go: new Set('any bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr'.split(' ')),
  java: new Set('boolean byte char double float int long short void String Object'.split(' ')),
  rust: new Set('bool char str u8 u16 u32 u64 u128 usize i8 i16 i32 i64 i128 isize f32 f64'.split(' ')),
  kotlin: new Set('Any Unit Nothing String Int Long Short Byte Float Double Boolean Char'.split(' ')),
  scala: new Set('Int Long Short Byte Float Double Boolean Char Unit String Any AnyRef AnyVal Nothing Null'.split(' ')),
  c: new Set('void char short int long float double signed unsigned size_t'.split(' ')),
  cpp: new Set('void bool char short int long float double signed unsigned size_t wchar_t'.split(' ')),
  objc: new Set('void BOOL char short int long float double id instancetype NSInteger NSUInteger'.split(' ')),
  csharp: new Set('void bool byte sbyte char short ushort int uint long ulong float double decimal string object dynamic'.split(' ')),
};

function nativeLanguageKey(language: Language): string {
  if (language === 'tsx') return 'typescript';
  if (language === 'jsx') return 'javascript';
  return language;
}

function nativeDefinitionOffsets(source: string, language: Language, tokens: readonly NativeToken[]): Set<number> {
  const facts = extractNativeFacts('__syntax__', source, language);
  const definitionKinds = new Set(['function', 'method', 'class', 'interface', 'struct', 'enum', 'type_alias', 'trait']);
  const definitions = facts.nodes.filter((node) =>
    definitionKinds.has(node.kind));
  const offsets = new Set<number>();
  for (const node of definitions) {
    const match = tokens.find((token) => token.kind === 'identifier' && token.text === node.name &&
      token.start.line === node.startLine && token.start.column >= node.startColumn);
    if (match) offsets.add(match.start.offset);
  }
  return offsets;
}

function classifyNativeRegion(source: string, language: Language, offset: number): SyntaxSpan[] {
  const key = nativeLanguageKey(language);
  const scan = scanSource(source, {
    hashComments: key === 'python',
    rustSyntax: key === 'rust',
    tripleQuotedStrings: key === 'kotlin' || key === 'scala',
    backtickIdentifiers: key === 'kotlin',
    cppRawStrings: key === 'cpp',
    csharpStrings: key === 'csharp',
  });
  const definitions = nativeDefinitionOffsets(source, language, scan.tokens);
  const keywords = NATIVE_KEYWORDS[key] ?? new Set<string>();
  const builtins = NATIVE_BUILTIN_TYPES[key] ?? new Set<string>();
  const out: SyntaxSpan[] = [];
  const appendAbsolute = (from: number, to: number, cls: SyntaxTokenClass): void => {
    if (to <= from) return;
    const last = out.at(-1);
    if (last && last.cls === cls && last.end === from) last.end = to;
    else out.push({ start: from, end: to, cls });
  };
  const append = (start: number, end: number, cls: SyntaxTokenClass): void =>
    appendAbsolute(start + offset, end + offset, cls);
  for (let index = 0; index < scan.tokens.length; index += 1) {
    const token = scan.tokens[index]!;
    let cls: SyntaxTokenClass = 'other';
    if (token.kind === 'comment') cls = 'comment';
    else if (token.kind === 'string') {
      if (['typescript', 'javascript'].includes(key) && token.text.startsWith('`') && token.text.includes('${')) {
        let cursor = 0;
        while (cursor < token.text.length) {
          const marker = token.text.indexOf('${', cursor);
          if (marker < 0) {
            append(token.start.offset + cursor, token.end.offset, 'string');
            break;
          }
          append(token.start.offset + cursor, token.start.offset + marker, 'string');
          append(token.start.offset + marker, token.start.offset + marker + 2, 'other');
          let end = marker + 2;
          let depth = 1;
          while (end < token.text.length && depth > 0) {
            if (token.text[end] === '{') depth += 1;
            else if (token.text[end] === '}') depth -= 1;
            end += 1;
          }
          const expressionEnd = depth === 0 ? end - 1 : token.text.length;
          for (const span of classifyNativeRegion(token.text.slice(marker + 2, expressionEnd), language,
            offset + token.start.offset + marker + 2)) {
            appendAbsolute(span.start, span.end, span.cls);
          }
          if (depth === 0) append(token.start.offset + expressionEnd, token.start.offset + end, 'other');
          cursor = end;
        }
        continue;
      }
      cls = 'string';
    }
    else if (token.kind === 'number') cls = 'number';
    else if (token.kind === 'identifier') {
      const previous = scan.tokens[index - 1]?.text;
      if (definitions.has(token.start.offset)) cls = 'def';
      else if (builtins.has(token.text)) cls = 'type';
      else if ((previous === ':' && key !== 'python') || previous === 'extends' || previous === 'implements' || previous === 'new') cls = 'type';
      else if (keywords.has(token.text)) cls = ['true', 'false', 'null', 'undefined', 'None', 'True', 'False', 'nil'].includes(token.text) ? 'number' : 'keyword';
      else cls = 'ident';
    }
    append(token.start.offset, token.end.offset, cls);
  }
  return out;
}

/**
 * Parse `source` and classify it.
 *
 * Returns null when nothing in the file has a grammar — a plain answer, which
 * every caller here already knows how to serve. Never throws: a grammar that
 * fails to load or a parse that comes back empty is the same outcome as not
 * having one.
 */
export async function tokenizeSource(
  source: string,
  language: Language
): Promise<TokenizeResult | null> {
  const regions = syntaxRegionsFor(source, language);
  if (regions === null) {
    const spans = await tokenizeRegion(source, language, 0);
    return spans ? { spans, grammars: [language] } : null;
  }
  if (regions.length === 0) return null;

  const spans: SyntaxSpan[] = [];
  const grammars = new Set<string>();
  for (const region of regions) {
    const part = await tokenizeRegion(
      source.slice(region.start, region.end),
      region.language,
      region.start
    );
    if (!part) continue;
    grammars.add(region.language);
    spans.push(...part);
  }
  if (spans.length === 0) return null;
  spans.sort((a, b) => a.start - b.start);
  return { spans, grammars: [...grammars] };
}

async function tokenizeRegion(
  source: string,
  language: Language,
  offset: number
): Promise<SyntaxSpan[] | null> {
  if (process.env.AFYX_GRAPH_NATIVE_PARSER === '1' && NATIVE_SYNTAX_LANGUAGES.has(language)) {
    return classifyNativeRegion(source, language, offset);
  }
  try {
    await loadGrammarsForLanguages([language]);
    const parser = getParser(language);
    if (!parser) return null;
    const tree = parser.parse(source);
    if (!tree?.rootNode) return null;
    try {
      return classifyTree(tree.rootNode, source, language, offset);
    } finally {
      tree.delete();
    }
  } catch {
    // A grammar that will not load, or a parse that threw: the caller serves
    // the source unclassified, which is the whole point of the plain path.
    return null;
  }
}
