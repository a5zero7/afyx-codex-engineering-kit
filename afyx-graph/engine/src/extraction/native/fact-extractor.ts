import * as path from 'path';
import type { Edge, ExtractionResult, Language, Node, NodeKind, UnresolvedReference } from '../../types';
import { generateNodeId } from '../node-id';
import { extractNativeCFamilyFacts, isNativeCFamilyLanguage } from './c-family-facts';
import { scanSource, type NativeToken } from './scanner';
import { extractNativeSwiftFacts } from './swift-facts';
import { extractNativeSolidityFacts } from './solidity-facts';
import { extractNativePhpFacts } from './php-facts';
import { extractNativeRubyFacts } from './ruby-facts';
import { extractNativeLuaFacts } from './lua-facts';
import { extractNativeRFacts } from './r-facts';

const CALL_EXCLUSIONS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'with', 'function', 'typeof', 'delete',
  'return', 'throw', 'new', 'class', 'interface', 'enum', 'constructor',
]);

const MODIFIERS = new Set([
  'export', 'default', 'declare', 'async', 'public', 'private', 'protected',
  'internal', 'static', 'abstract', 'readonly', 'override', 'final',
]);

const TS_FAMILY_LANGUAGES: ReadonlySet<Language> = new Set([
  'typescript', 'tsx', 'javascript', 'jsx', 'arkts',
]);

const TYPED_TS_FAMILY_LANGUAGES: ReadonlySet<Language> = new Set([
  'typescript', 'tsx', 'arkts',
]);

interface Declaration {
  readonly kind: NodeKind;
  readonly name: string;
  readonly start: number;
  readonly end: number;
  readonly bodyStart?: number;
  readonly bodyEnd?: number;
  readonly parent?: Declaration;
  readonly exported?: boolean;
  readonly async?: boolean;
  readonly static?: boolean;
  readonly visibility?: Node['visibility'];
  readonly signature?: string;
  readonly extendsName?: string;
  readonly returnType?: string;
  readonly decorators?: string[];
}

function cleanDocComment(text: string): string {
  return text.trim()
    .replace(/^\/\*+!?/, '').replace(/\*+\/$/, '')
    .replace(/^\/\/[/!]?[ ]?/gm, '')
    .replace(/^#[ ]?/gm, '')
    .replace(/^\s*\*[ ]?/gm, '')
    .trim();
}

function precedingDoc(tokens: readonly NativeToken[], declaration: Declaration): string | undefined {
  const start = tokens[declaration.start]!;
  for (let i = declaration.start - 1; i >= 0; i -= 1) {
    const token = tokens[i]!;
    if (token.kind === 'comment') {
      return start.start.line - token.end.line <= 3 ? cleanDocComment(token.text) : undefined;
    }
    if (token.text === '}' || token.text === ';') return undefined;
    if (start.start.line - token.end.line > 2) return undefined;
    if (['class', 'function', 'def', 'interface', 'enum'].includes(token.text)) return undefined;
  }
  return undefined;
}

function tokenEndLine(token: NativeToken): number {
  return token.end.line;
}

function previousWord(tokens: readonly NativeToken[], index: number): string | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    const token = tokens[i]!;
    if (token.kind === 'identifier') return token.text;
    if (!MODIFIERS.has(token.text)) return undefined;
  }
  return undefined;
}

function declarationStart(tokens: readonly NativeToken[], index: number): number {
  let start = index;
  while (start > 0 && MODIFIERS.has(tokens[start - 1]!.text)) start -= 1;
  return start;
}

function findNext(tokens: readonly NativeToken[], from: number, text: string, limit = tokens.length): number {
  for (let i = from; i < limit; i += 1) if (tokens[i]!.text === text) return i;
  return -1;
}

function visibility(tokens: readonly NativeToken[], start: number, keyword: number): Node['visibility'] {
  for (let i = start; i < keyword; i += 1) {
    const value = tokens[i]!.text;
    if (value === 'public' || value === 'private' || value === 'protected' || value === 'internal') return value;
  }
  return undefined;
}

/**
 * First native fact recognizer: the shared JS/TS declaration and call surface.
 * It deliberately consumes scanner tokens/ranges directly and does not expose
 * or emulate a Tree-sitter node API.
 */
export function extractNativeFacts(filePath: string, source: string, language: Language): ExtractionResult {
  if (isNativeCFamilyLanguage(language)) return extractNativeCFamilyFacts(filePath, source, language);
  if (language === 'swift') return extractNativeSwiftFacts(filePath, source);
  if (language === 'solidity') return extractNativeSolidityFacts(filePath, source);
  if (language === 'php') return extractNativePhpFacts(filePath, source);
  if (language === 'ruby') return extractNativeRubyFacts(filePath, source);
  if (language === 'lua' || language === 'luau') return extractNativeLuaFacts(filePath, source, language);
  if (language === 'r') return extractNativeRFacts(filePath, source);
  const started = Date.now();
  const scan = scanSource(source, {
    hashComments: ['python', 'ruby', 'r'].includes(language),
    rustSyntax: language === 'rust',
    tripleQuotedStrings: language === 'kotlin' || language === 'scala',
    backtickIdentifiers: language === 'kotlin',
  });
  const tokens = scan.tokens;
  const declarations: Declaration[] = [];
  const tokenLineEnd = (from: number): number => {
    const line = tokens[from]?.start.line;
    let end = from;
    while (end + 1 < tokens.length && tokens[end + 1]!.start.line === line) end += 1;
    return end;
  };
  const statementEnd = (from: number): number => {
    let end = tokenLineEnd(from);
    for (let i = from; i < tokens.length; i += 1) {
      if (tokens[i]!.text === ';') return i;
      if (tokens[i]!.start.line > (tokens[from]?.start.line ?? 0) && tokens[i]!.start.column <= (tokens[from]?.start.column ?? 0)) break;
      end = i;
    }
    return end;
  };
  const pairedBody = (from: number): { start: number; end: number } | undefined => {
    const open = findNext(tokens, from, '{');
    if (open < 0) return undefined;
    const end = scan.pairs.get(open);
    return end === undefined ? { start: open, end: open } : { start: open, end };
  };
  const indentationBody = (header: number, marker: number): { start: number; end: number } | undefined => {
    const baseColumn = tokens[header]?.start.column ?? 0;
    const headerLine = tokens[header]?.start.line ?? 0;
    let first = marker + 1;
    while (first < tokens.length && tokens[first]!.start.line === headerLine) first += 1;
    if (first >= tokens.length || tokens[first]!.start.column <= baseColumn) return undefined;
    let end = first;
    while (end + 1 < tokens.length) {
      const next = tokens[end + 1]!;
      if (next.start.line > headerLine && next.start.column <= baseColumn) break;
      end += 1;
    }
    return { start: marker, end };
  };
  const kotlinMarkers = (index: number): string[] | undefined => {
    const line = tokens[index]?.start.line;
    const values = tokens.slice(Math.max(0, index - 8), index)
      .filter((token) => token.start.line === line && (token.text === 'expect' || token.text === 'actual'))
      .map((token) => token.text);
    return values.length > 0 ? values : undefined;
  };
  const arktsDecorators = (index: number): string[] | undefined => {
    if (language !== 'arkts') return undefined;
    let start = index - 1;
    while (start >= 0 && ![';', '{', '}'].includes(tokens[start]!.text)) start -= 1;
    const names: string[] = [];
    for (let cursor = start + 1; cursor < index - 1; cursor += 1) {
      if (tokens[cursor]!.text === '@' && tokens[cursor + 1]?.kind === 'identifier') {
        names.push(tokens[cursor + 1]!.text);
      }
    }
    return names.length > 0 ? names : undefined;
  };
  const importedNames = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i]!.text !== 'import') continue;
    for (let j = i + 1; j < tokens.length && tokens[j]!.start.line === tokens[i]!.start.line; j += 1) {
      const token = tokens[j]!;
      if (token.kind === 'string') break;
      if (token.kind === 'identifier' && token.text !== 'from' && token.text !== 'as') importedNames.add(token.text);
    }
  }

  if (language === 'java') {
    const packageIndex = tokens.findIndex((token) => token.text === 'package');
    if (packageIndex >= 0) {
      const end = findNext(tokens, packageIndex + 1, ';');
      if (end > packageIndex + 1) {
        const name = tokens.slice(packageIndex + 1, end)
          .filter((token) => token.kind === 'identifier' || token.text === '.')
          .map((token) => token.text).join('');
        if (name) declarations.push({ kind: 'namespace', name, start: packageIndex, end });
      }
    }
  }

  if (TS_FAMILY_LANGUAGES.has(language)) {
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const token = tokens[i]!;
      const name = tokens[i + 1]!;
      if (token.text === 'type' && name.kind === 'identifier') {
        const equals = findNext(tokens, i + 2, '=');
        const bodyStart = equals < 0 ? -1 : equals + 1;
        const pairedEnd = bodyStart >= 0 && ['{', '['].includes(tokens[bodyStart]?.text ?? '')
          ? scan.pairs.get(bodyStart)
          : undefined;
        const statementEnd = findNext(tokens, i + 2, ';');
        const end = pairedEnd ?? (statementEnd < 0 ? i + 1 : statementEnd);
        declarations.push({
          kind: 'type_alias', name: name.text, start: i, end,
          bodyStart: bodyStart >= 0 && ['{', '['].includes(tokens[bodyStart]?.text ?? '') ? bodyStart : undefined,
          bodyEnd: pairedEnd,
          exported: tokens[i - 1]?.text === 'export',
        });
      }
      if (!['const', 'let', 'var'].includes(token.text) || name.kind !== 'identifier') continue;
      const statementEnd = findNext(tokens, i + 2, ';');
      const limit = statementEnd < 0 ? tokens.length : statementEnd + 1;
      const equals = findNext(tokens, i + 2, '=', limit);
      const arrow = findNext(tokens, i + 2, '=>', limit);
      const functionKeyword = findNext(tokens, i + 2, 'function', limit);
      const valueStart = equals < 0 ? i + 2 : equals + 1;
      const valueToken = tokens[valueStart];
      const directArrow = arrow >= 0 && (
        valueToken?.text === 'async' || (valueToken?.kind === 'identifier' && tokens[valueStart + 1]?.text === '=>') ||
        (valueToken?.text === '(' && scan.pairs.has(valueStart))
      );
      const callable = directArrow || functionKeyword === valueStart || (valueToken?.text === 'async' && functionKeyword === valueStart + 1);
      const marker = arrow >= 0 ? arrow : functionKeyword;
      const callableBody = !callable || marker < 0 ? undefined : findNext(tokens, marker + 1, '{', limit);
      const objectBody = !callable && valueToken?.text === '{' ? valueStart : undefined;
      const bodyStart = objectBody ?? callableBody;
      const bodyEnd = bodyStart === undefined || bodyStart < 0 ? undefined : scan.pairs.get(bodyStart);
      declarations.push({
        kind: callable ? 'function' : token.text === 'const' ? 'constant' : 'variable',
        name: name.text, start: i + 1, end: bodyEnd ?? (statementEnd < 0 ? name === tokens.at(-1) ? i + 1 : limit - 1 : statementEnd),
        bodyStart: bodyStart === undefined || bodyStart < 0 ? undefined : bodyStart,
        bodyEnd,
        exported: tokens[i - 1]?.text === 'export',
        async: tokens.slice(i + 2, marker < 0 ? limit : marker).some((item) => item.text === 'async'),
      });
    }
  }

  if (language === 'python') {
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const keyword = tokens[i]!;
      if (keyword.text !== 'class' && keyword.text !== 'def') continue;
      const name = tokens[i + 1]!;
      if (name.kind !== 'identifier') continue;
      let end = tokens.length - 1;
      for (let j = i + 2; j < tokens.length; j += 1) {
        const candidate = tokens[j]!;
        if (candidate.start.line > keyword.start.line && candidate.start.column <= keyword.start.column) {
          end = j - 1;
          break;
        }
      }
      declarations.push({
        kind: keyword.text === 'class' ? 'class' : 'function',
        name: name.text, start: i, end, bodyStart: i + 1, bodyEnd: end,
        async: tokens[i - 1]?.text === 'async',
      });
    }
    const classes = declarations.filter((item) => item.kind === 'class');
    for (let i = 0; i < declarations.length; i += 1) {
      const declaration = declarations[i]!;
      if (declaration.kind !== 'function') continue;
      const owner = classes.find((item) =>
        item.start < declaration.start && item.end >= declaration.end &&
        tokens[item.start]!.start.column < tokens[declaration.start]!.start.column);
      if (owner) {
        declarations[i] = { ...declaration, kind: 'method', parent: owner };
      }
    }
    for (let i = 0; i < tokens.length - 2; i += 1) {
      const name = tokens[i]!;
      if (name.kind !== 'identifier' || name.start.column !== 0 || tokens[i + 1]?.text !== '=') continue;
      let end = i + 2;
      while (end + 1 < tokens.length && tokens[end + 1]!.start.line === name.start.line) end += 1;
      declarations.push({ kind: 'variable', name: name.text, start: i, end, bodyStart: i + 1, bodyEnd: end + 1 });
      i = end;
    }
  }

  if (language === 'go') {
    for (let i = 0; i < tokens.length - 2; i += 1) {
      if (tokens[i]!.text === 'type' && tokens[i + 1]!.kind === 'identifier') {
        let shapeIndex = i + 2;
        if (tokens[shapeIndex]?.text === '[') {
          const genericEnd = scan.pairs.get(shapeIndex);
          if (genericEnd === undefined) continue;
          shapeIndex = genericEnd + 1;
        }
        const shape = tokens[shapeIndex]!.text;
        if (shape !== 'struct' && shape !== 'interface') continue;
        const open = findNext(tokens, shapeIndex + 1, '{');
        const close = open < 0 ? undefined : scan.pairs.get(open);
        declarations.push({
          kind: shape, name: tokens[i + 1]!.text, start: i + 1, end: close ?? i + 2,
          bodyStart: open < 0 ? undefined : open, bodyEnd: close,
          exported: /^[A-Z]/.test(tokens[i + 1]!.text),
        });
      }
      if (tokens[i]!.text !== 'func') continue;
      let nameIndex = i + 1;
      let receiverOwner: Declaration | undefined;
      if (tokens[nameIndex]?.text === '(') {
        const receiverEnd = scan.pairs.get(nameIndex);
        if (receiverEnd === undefined) continue;
        const receiverType = tokens.slice(nameIndex + 1, receiverEnd)
          .find((token) => token.kind === 'identifier' && /^[A-Z]/.test(token.text));
        receiverOwner = receiverType && declarations.find((item) => item.name === receiverType.text);
        nameIndex = receiverEnd + 1;
      }
      if (tokens[nameIndex]?.kind !== 'identifier') continue;
      const params = findNext(tokens, nameIndex + 1, '(');
      const paramsEnd = params < 0 ? undefined : scan.pairs.get(params);
      const open = paramsEnd === undefined ? -1 : findNext(tokens, paramsEnd + 1, '{');
      const close = open < 0 ? undefined : scan.pairs.get(open);
      declarations.push({
        kind: tokens[i + 1]?.text === '(' ? 'method' : 'function', name: tokens[nameIndex]!.text, start: i, end: close ?? (paramsEnd ?? nameIndex),
        bodyStart: open < 0 ? undefined : open, bodyEnd: close,
        exported: /^[A-Z]/.test(tokens[nameIndex]!.text),
        parent: receiverOwner,
      });
    }
  }

  if (language === 'go') {
    const owners = declarations.filter((item) => item.kind === 'struct' || item.kind === 'interface');
    for (let i = 0; i < declarations.length; i += 1) {
      const declaration = declarations[i]!;
      if (declaration.kind !== 'method') continue;
      const open = declaration.start + 1;
      const close = scan.pairs.get(open);
      if (close === undefined) continue;
      let receiverType: NativeToken | undefined;
      for (let j = open + 1; j < close; j += 1) {
        const token = tokens[j]!;
        if (token.kind === 'identifier' && /^[A-Z]/.test(token.text)) {
          receiverType = token;
          break;
        }
      }
      const owner = receiverType && owners.find((item) => item.name === receiverType.text);
      if (owner) declarations[i] = { ...declaration, parent: owner };
    }
  }

  const rustImpls: Array<{
    keyword: number;
    bodyStart: number;
    bodyEnd: number;
    typeName?: string;
    traitName?: string;
  }> = [];

  if (language === 'rust') {
    const rustVisibility = (index: number): Node['visibility'] =>
      tokens.slice(Math.max(0, index - 3), index).some((token) => token.text === 'pub') ? 'public' : 'private';
    const rustEnd = (keyword: number, nameIndex: number): { bodyStart?: number; bodyEnd?: number; end: number } => {
      for (let i = nameIndex + 1; i < tokens.length; i += 1) {
        const text = tokens[i]!.text;
        if (text === '{') {
          const close = scan.pairs.get(i);
          return { bodyStart: i, bodyEnd: close, end: close ?? i };
        }
        if (text === '(') {
          const close = scan.pairs.get(i);
          if (close !== undefined && tokens[close + 1]?.text === ';') return { end: close + 1 };
        }
        if (text === ';') return { end: i };
        if (tokens[i]!.start.line > tokens[keyword]!.start.line + 40) break;
      }
      return { end: nameIndex };
    };

    for (let i = 0; i < tokens.length - 1; i += 1) {
      const keyword = tokens[i]!.text;
      if (!['struct', 'union', 'enum', 'trait'].includes(keyword)) continue;
      const nameIndex = i + 1;
      if (tokens[nameIndex]?.kind !== 'identifier') continue;
      const range = rustEnd(i, nameIndex);
      declarations.push({
        kind: keyword === 'trait' ? 'trait' : keyword as 'struct' | 'union' | 'enum',
        name: tokens[nameIndex]!.text,
        start: tokens[i - 1]?.text === 'pub' ? i - 1 : i,
        end: range.end,
        bodyStart: range.bodyStart,
        bodyEnd: range.bodyEnd,
        exported: rustVisibility(i) === 'public',
        visibility: rustVisibility(i),
      });
    }

    const rustTypes = () => declarations.filter((item) =>
      ['struct', 'union', 'enum', 'trait'].includes(item.kind));
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i]!.text !== 'impl') continue;
      let bodyStart = i + 1;
      while (bodyStart < tokens.length && tokens[bodyStart]!.text !== '{') bodyStart += 1;
      if (tokens[bodyStart]?.text !== '{') continue;
      const bodyEnd = scan.pairs.get(bodyStart);
      if (bodyEnd === undefined) continue;
      let forIndex = -1;
      for (let cursor = i + 1; cursor < bodyStart; cursor += 1) {
        if (tokens[cursor]!.text === 'for') forIndex = cursor;
      }
      const typeStart = forIndex >= 0 ? forIndex + 1 : i + 1;
      let genericDepth = 0;
      const candidates: NativeToken[] = [];
      for (let cursor = typeStart; cursor < bodyStart; cursor += 1) {
        const token = tokens[cursor]!;
        if (token.text === '<') { genericDepth += 1; continue; }
        if (token.text === '>') { genericDepth = Math.max(0, genericDepth - 1); continue; }
        if (genericDepth === 0 && token.kind === 'identifier' && !['mut', 'dyn', 'where'].includes(token.text)) candidates.push(token);
      }
      const typeToken = [...candidates].reverse().find((token) => /^[A-Z]/.test(token.text));
      let traitName: string | undefined;
      if (forIndex >= 0) {
        let traitStart = i + 1;
        if (tokens[traitStart]?.text === '<') {
          let depth = 0;
          while (traitStart < forIndex) {
            if (tokens[traitStart]!.text === '<') depth += 1;
            else if (tokens[traitStart]!.text === '>') {
              depth -= 1;
              if (depth === 0) { traitStart += 1; break; }
            }
            traitStart += 1;
          }
        }
        const first = tokens[traitStart];
        const last = tokens[forIndex - 1];
        if (first && last) traitName = source.slice(first.start.offset, last.end.offset).trim();
      }
      rustImpls.push({ keyword: i, bodyStart, bodyEnd, typeName: typeToken?.text, traitName });
      i = bodyStart;
    }

    for (let i = 0; i < tokens.length - 1; i += 1) {
      const keyword = tokens[i]!.text;
      if (keyword === 'type' && tokens[i + 1]?.kind === 'identifier') {
        declarations.push({
          kind: 'type_alias', name: tokens[i + 1]!.text,
          start: tokens[i - 1]?.text === 'pub' ? i - 1 : i,
          end: statementEnd(i), exported: rustVisibility(i) === 'public', visibility: rustVisibility(i),
        });
        continue;
      }
      if ((keyword === 'const' || keyword === 'static') && tokens[i + 1]?.kind === 'identifier') {
        const end = statementEnd(i);
        const equals = findNext(tokens, i + 2, '=', end + 1);
        declarations.push({
          kind: 'variable', name: tokens[i + 1]!.text,
          start: tokens[i - 1]?.text === 'pub' ? i - 1 : i, end,
          bodyStart: equals >= 0 ? equals : undefined, bodyEnd: equals >= 0 ? end : undefined,
          exported: rustVisibility(i) === 'public', visibility: rustVisibility(i),
        });
      }
    }

    const rustReturnType = (from: number, to: number): string | undefined => {
      const arrow = findNext(tokens, from, '->', to);
      if (arrow < 0) return undefined;
      const rawTokens = tokens.slice(arrow + 1, to).filter((token) => !['&', 'mut'].includes(token.text) && !token.text.startsWith("'"));
      if (rawTokens.some((token) => token.text === '(' || token.text === '[' || token.text === '*')) return undefined;
      const base = rawTokens.find((token) => token.kind === 'identifier');
      if (!base) return undefined;
      const primitive = new Set(['bool', 'char', 'str', 'u8', 'u16', 'u32', 'u64', 'u128', 'usize', 'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'f32', 'f64']);
      if (primitive.has(base.text)) return undefined;
      const identifiers = rawTokens.filter((token) => token.kind === 'identifier');
      const name = identifiers.find((token) => token.text === 'Self') ?? identifiers.at(-1);
      return name?.text === 'Self' ? 'self' : name?.text;
    };

    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i]!.text !== 'fn' || tokens[i + 1]?.kind !== 'identifier') continue;
      const nameIndex = i + 1;
      const params = findNext(tokens, nameIndex + 1, '(');
      const paramsEnd = params < 0 ? undefined : scan.pairs.get(params);
      if (paramsEnd === undefined) continue;
      let bodyStart = paramsEnd + 1;
      while (bodyStart < tokens.length && !['{', ';'].includes(tokens[bodyStart]!.text)) bodyStart += 1;
      const bodyEnd = tokens[bodyStart]?.text === '{' ? scan.pairs.get(bodyStart) : undefined;
      const end = bodyEnd ?? (tokens[bodyStart]?.text === ';' ? bodyStart : paramsEnd);
      const impl = rustImpls.find((item) => item.bodyStart < i && i < item.bodyEnd);
      const trait = rustTypes().find((item) => item.kind === 'trait' && item.bodyStart !== undefined && item.bodyStart < i && item.end >= end);
      const owner = impl?.typeName
        ? rustTypes().find((item) => item.name === impl.typeName && item.kind !== 'trait')
        : trait;
      const signatureEnd = tokens[bodyStart]?.text === '{' || tokens[bodyStart]?.text === ';' ? bodyStart : paramsEnd + 1;
      declarations.push({
        kind: owner || trait ? 'method' : 'function', name: tokens[nameIndex]!.text,
        start: tokens[i - 1]?.text === 'pub' || tokens[i - 1]?.text === 'async' ? i - 1 : i,
        end, bodyStart: bodyEnd === undefined ? undefined : bodyStart, bodyEnd,
        parent: owner ?? trait,
        exported: rustVisibility(i) === 'public', visibility: rustVisibility(i),
        async: tokens[i - 1]?.text === 'async',
        signature: source.slice(tokens[params]!.start.offset, tokens[signatureEnd - 1]?.end.offset ?? tokens[paramsEnd]!.end.offset).trim(),
        returnType: rustReturnType(paramsEnd + 1, bodyStart),
      });
    }

    for (const parent of rustTypes().filter((item) => item.kind === 'enum' && item.bodyStart !== undefined && item.bodyEnd !== undefined)) {
      let cursor = parent.bodyStart! + 1;
      while (cursor < parent.bodyEnd!) {
        const token = tokens[cursor]!;
        if (token.kind === 'identifier') {
          declarations.push({ kind: 'enum_member', name: token.text, start: cursor, end: cursor, parent });
          cursor += 1;
          if (tokens[cursor]?.text === '(' || tokens[cursor]?.text === '{') cursor = (scan.pairs.get(cursor) ?? cursor) + 1;
          while (cursor < parent.bodyEnd! && tokens[cursor]!.text !== ',') cursor += 1;
        }
        cursor += 1;
      }
    }
  }

  const kotlinSingletons = new Set<Declaration>();
  if (language === 'kotlin') {
    const typeDeclarations: Declaration[] = [];
    const packageIndex = tokens.findIndex((token) => token.text === 'package');
    if (packageIndex >= 0) {
      const end = statementEnd(packageIndex);
      const name = tokens.slice(packageIndex + 1, end + 1)
        .filter((token) => token.kind === 'identifier' || token.text === '.')
        .map((token) => token.text).join('');
      if (name) declarations.push({ kind: 'namespace', name, start: packageIndex, end });
    }
    for (let i = 0; i < tokens.length; i += 1) {
      let keyword = tokens[i]!.text;
      let nameIndex = i + 1;
      let kind: NodeKind | undefined;
      let singleton = false;
      if (keyword === 'fun' && tokens[i + 1]?.text === 'interface') {
        keyword = 'interface'; nameIndex = i + 2; kind = 'interface';
      } else if (keyword === 'enum' && tokens[i + 1]?.text === 'class') {
        nameIndex = i + 2; kind = 'enum';
      } else if (keyword === 'class') kind = 'class';
      else if (keyword === 'interface' && tokens[i - 1]?.text !== 'fun') kind = 'interface';
      else if (keyword === 'object' && tokens[i - 1]?.text !== 'companion') { kind = 'class'; singleton = true; }
      else if (keyword === 'companion' && tokens[i + 1]?.text === 'object') {
        nameIndex = tokens[i + 2]?.kind === 'identifier' ? i + 2 : -1;
        kind = 'class'; singleton = true;
      }
      if (!kind) continue;
      const name = nameIndex >= 0 ? tokens[nameIndex] : undefined;
      const search = nameIndex >= 0 ? nameIndex + 1 : i + 2;
      const body = pairedBody(search);
      const end = body?.end ?? statementEnd(i);
      const parent = typeDeclarations.filter((item) => item.bodyStart !== undefined && item.bodyStart < i && item.end >= end)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
      const declaration: Declaration = {
        kind, name: name?.kind === 'identifier' ? name.text : 'Companion', start: i, end,
        bodyStart: body?.start, bodyEnd: body?.end, parent, visibility: visibility(tokens, declarationStart(tokens, i), i),
        decorators: kotlinMarkers(i),
      };
      declarations.push(declaration); typeDeclarations.push(declaration);
      if (singleton) kotlinSingletons.add(declaration);
    }

    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i]!.text === 'typealias' && tokens[i + 1]?.kind === 'identifier') {
        declarations.push({
          kind: 'type_alias', name: tokens[i + 1]!.text, start: i, end: statementEnd(i),
          decorators: kotlinMarkers(i),
        });
      }
      if (tokens[i]!.text !== 'fun') continue;
      if (tokens[i + 1]?.text === 'interface') continue;
      const params = findNext(tokens, i + 1, '(');
      const paramsEnd = params < 0 ? undefined : scan.pairs.get(params);
      if (paramsEnd === undefined) continue;
      let nameIndex = params - 1;
      while (nameIndex > i && tokens[nameIndex]!.kind !== 'identifier') nameIndex -= 1;
      if (nameIndex <= i) continue;
      let bodyMarker = paramsEnd + 1;
      while (bodyMarker < tokens.length && !['{', '=', ';', '}'].includes(tokens[bodyMarker]!.text) &&
             tokens[bodyMarker]!.start.line <= tokens[i]!.start.line + 1) bodyMarker += 1;
      let bodyStart: number | undefined;
      let bodyEnd: number | undefined;
      let end = paramsEnd;
      if (tokens[bodyMarker]?.text === '{') {
        bodyStart = bodyMarker; bodyEnd = scan.pairs.get(bodyMarker); end = bodyEnd ?? bodyMarker;
      } else if (tokens[bodyMarker]?.text === '=') {
        bodyStart = bodyMarker; bodyEnd = statementEnd(bodyMarker); end = bodyEnd;
      }
      const lexicalParent = typeDeclarations.filter((item) => item.bodyStart !== undefined && item.bodyStart < i && item.end >= end)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
      const parent = lexicalParent?.name === 'Companion' && lexicalParent.parent ? lexicalParent.parent : lexicalParent;
      const returnColon = findNext(tokens, paramsEnd + 1, ':', bodyMarker);
      const returnToken = returnColon >= 0
        ? tokens.slice(returnColon + 1, bodyMarker).find((token) => token.kind === 'identifier')
        : undefined;
      const returnType = returnToken && !['Unit', 'Nothing'].includes(returnToken.text) ? returnToken.text : undefined;
      declarations.push({
        kind: parent ? 'method' : 'function', name: tokens[nameIndex]!.text, start: i, end,
        bodyStart, bodyEnd, parent, visibility: visibility(tokens, declarationStart(tokens, i), i),
        async: tokens.slice(Math.max(0, i - 4), i).some((token) => token.text === 'suspend'),
        decorators: kotlinMarkers(i),
        signature: source.slice(tokens[params]!.start.offset, tokens[bodyMarker]?.start.offset ?? tokens[paramsEnd]!.end.offset).trim(),
        returnType,
      });
    }

    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (!['val', 'var'].includes(tokens[i]!.text)) continue;
      if (tokens[i + 1]?.text === '(') continue;
      const name = tokens[i + 1];
      if (name?.kind !== 'identifier') continue;
      const callable = declarations.find((item) => (item.kind === 'function' || item.kind === 'method') &&
        item.bodyStart !== undefined && item.bodyStart < i && item.end >= i);
      const inInit = [...scan.pairs.entries()].some(([open, close]) =>
        tokens[open]?.text === '{' && open < i && i < close && tokens[open - 1]?.text === 'init');
      if (callable || inInit) continue;
      const parent = typeDeclarations.filter((item) => item.bodyStart !== undefined && item.bodyStart < i && item.end >= i)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
      let end = statementEnd(i);
      const equals = findNext(tokens, i + 2, '=', end + 1);
      if (equals >= 0) {
        const lambdaOpen = findNext(tokens, equals + 1, '{', Math.min(tokens.length, end + 20));
        const lambdaEnd = lambdaOpen >= 0 ? scan.pairs.get(lambdaOpen) : undefined;
        if (lambdaEnd !== undefined) end = Math.max(end, lambdaEnd);
      }
      const isVal = tokens[i]!.text === 'val';
      const kind: NodeKind = parent && !kotlinSingletons.has(parent) ? 'field' : isVal ? 'constant' : 'variable';
      declarations.push({
        kind, name: name.text, start: i, end, bodyStart: equals >= 0 ? equals : undefined,
        bodyEnd: equals >= 0 ? end : undefined, parent,
        visibility: visibility(tokens, declarationStart(tokens, i), i),
      });
    }

    for (const parent of typeDeclarations.filter((item) => item.kind === 'enum' && item.bodyStart !== undefined && item.bodyEnd !== undefined)) {
      for (let i = parent.bodyStart! + 1; i < parent.bodyEnd!; i += 1) {
        const token = tokens[i]!;
        if (token.kind !== 'identifier' || !/^[A-Z]/.test(token.text)) continue;
        if (tokens[i - 1]?.text !== '{' && tokens[i - 1]?.text !== ',') continue;
        declarations.push({ kind: 'enum_member', name: token.text, start: i, end: i, parent });
      }
    }
  }

  const scalaSingletons = new Set<Declaration>();
  if (language === 'scala') {
    const typeDeclarations: Declaration[] = [];
    const scalaBody = (keyword: number, nameIndex: number): { start: number; end: number } | undefined => {
      const brace = findNext(tokens, nameIndex + 1, '{', Math.min(tokens.length, nameIndex + 80));
      if (brace >= 0 && tokens[brace]!.start.line <= tokens[keyword]!.start.line + 3) {
        const end = scan.pairs.get(brace);
        if (end !== undefined) return { start: brace, end };
      }
      const colon = findNext(tokens, nameIndex + 1, ':', tokenLineEnd(keyword) + 1);
      return colon >= 0 ? indentationBody(keyword, colon) : undefined;
    };
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const keyword = tokens[i]!.text;
      if (!['class', 'object', 'trait', 'enum'].includes(keyword) || tokens[i + 1]?.kind !== 'identifier') continue;
      const body = scalaBody(i, i + 1);
      const end = body?.end ?? statementEnd(i);
      const parent = typeDeclarations.filter((item) => item.bodyStart !== undefined && item.bodyStart < i && item.end >= end)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
      const declaration: Declaration = {
        kind: keyword === 'trait' ? 'trait' : keyword === 'enum' ? 'enum' : 'class',
        name: tokens[i + 1]!.text, start: tokens[i - 1]?.text === 'case' ? i - 1 : i, end,
        bodyStart: body?.start, bodyEnd: body?.end, parent,
        visibility: visibility(tokens, declarationStart(tokens, i), i) ?? 'public',
      };
      declarations.push(declaration); typeDeclarations.push(declaration);
      if (keyword === 'object') scalaSingletons.add(declaration);
    }
    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i]!.text === 'type' && tokens[i + 1]?.kind === 'identifier') {
        declarations.push({ kind: 'type_alias', name: tokens[i + 1]!.text, start: i, end: statementEnd(i), visibility: 'public' });
      }
      if (tokens[i]!.text !== 'def' || tokens[i + 1]?.kind !== 'identifier') continue;
      const nameIndex = i + 1;
      const params = tokens[nameIndex + 1]?.text === '(' ? nameIndex + 1 : findNext(tokens, nameIndex + 1, '(');
      const paramsEnd = params < 0 ? nameIndex : (scan.pairs.get(params) ?? params);
      let marker = paramsEnd + 1;
      while (marker < tokens.length && !['{', '=', ':'].includes(tokens[marker]!.text) &&
             tokens[marker]!.start.line <= tokens[i]!.start.line + 2) marker += 1;
      const returnColon = tokens[marker]?.text === ':' ? marker : -1;
      if (returnColon >= 0) {
        marker += 1;
        while (marker < tokens.length && !['{', '='].includes(tokens[marker]!.text) &&
               tokens[marker]!.start.line <= tokens[i]!.start.line + 3) marker += 1;
      }
      let bodyStart: number | undefined;
      let bodyEnd: number | undefined;
      let end = paramsEnd;
      if (tokens[marker]?.text === '{') {
        bodyStart = marker; bodyEnd = scan.pairs.get(marker); end = bodyEnd ?? marker;
      } else if (tokens[marker]?.text === '=') {
        bodyStart = marker;
        const indentation = indentationBody(i, marker);
        bodyEnd = indentation?.end ?? statementEnd(marker);
        end = bodyEnd;
      }
      const parent = typeDeclarations.filter((item) => item.bodyStart !== undefined && item.bodyStart < i && item.end >= end)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
      const inExtension = [...scan.pairs.entries()].some(([open, close]) =>
        tokens[open]?.text === '{' && open < i && i < close &&
        tokens.slice(Math.max(0, open - 20), open).some((token) => token.text === 'extension'));
      const returnTokens = returnColon >= 0 ? tokens.slice(returnColon + 1, marker) : [];
      const returnType = returnTokens.some((token) => token.text === 'this') ? undefined
        : returnTokens.filter((token) => token.kind === 'identifier').at(-1)?.text;
      declarations.push({
        kind: parent || inExtension ? 'method' : 'function', name: tokens[nameIndex]!.text, start: i, end, bodyStart, bodyEnd, parent,
        visibility: visibility(tokens, declarationStart(tokens, i), i) ?? 'public',
        signature: params >= 0 ? source.slice(tokens[params]!.start.offset, tokens[marker]?.start.offset ?? tokens[paramsEnd]!.end.offset).trim() : undefined,
        returnType,
      });
    }
    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (!['val', 'var'].includes(tokens[i]!.text) || tokens[i + 1]?.kind !== 'identifier') continue;
      const callable = declarations.find((item) => (item.kind === 'function' || item.kind === 'method') &&
        item.bodyStart !== undefined && item.bodyStart < i && item.end >= i);
      if (callable) continue;
      const parent = typeDeclarations.filter((item) => item.bodyStart !== undefined && item.bodyStart < i && item.end >= i)
        .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
      const end = statementEnd(i);
      const equals = findNext(tokens, i + 2, '=', end + 1);
      const isVal = tokens[i]!.text === 'val';
      const kind: NodeKind = parent && !scalaSingletons.has(parent) ? 'field' : isVal ? 'constant' : 'variable';
      declarations.push({
        kind, name: tokens[i + 1]!.text, start: i, end,
        bodyStart: equals >= 0 ? equals : undefined, bodyEnd: equals >= 0 ? end : undefined,
        parent, visibility: visibility(tokens, declarationStart(tokens, i), i) ?? 'public',
      });
    }
    for (const parent of typeDeclarations.filter((item) => item.kind === 'enum' && item.bodyStart !== undefined && item.bodyEnd !== undefined)) {
      for (let i = parent.bodyStart! + 1; i <= parent.bodyEnd!; i += 1) {
        if (tokens[i]!.text !== 'case' || tokens[i + 1]?.kind !== 'identifier') continue;
        const line = tokens[i]!.start.line;
        for (let cursor = i + 1; cursor <= parent.bodyEnd! && tokens[cursor]!.start.line === line; cursor += 1) {
          if (tokens[cursor]!.kind !== 'identifier' || (cursor > i + 1 && tokens[cursor - 1]?.text !== ',')) continue;
          declarations.push({ kind: 'enum_member', name: tokens[cursor]!.text, start: cursor, end: cursor, parent });
        }
      }
    }
  }

  const addBlockDeclaration = (kind: NodeKind, keyword: number, nameIndex: number): Declaration | undefined => {
    let searchFrom = nameIndex + 1;
    let params = -1;
    let paramsEnd: number | undefined;
    if (kind === 'function') {
      params = findNext(tokens, nameIndex + 1, '(');
      paramsEnd = params < 0 ? undefined : scan.pairs.get(params);
      if (paramsEnd !== undefined) searchFrom = paramsEnd + 1;
    }
    const open = findNext(tokens, searchFrom, '{');
    if (open < 0) return undefined;
    const close = scan.pairs.get(open);
    const modifierStart = declarationStart(tokens, keyword);
    const declaration: Declaration = {
      kind,
      name: tokens[nameIndex]!.text,
      start: language === 'java' ? modifierStart : keyword,
      end: close ?? open,
      bodyStart: open,
      bodyEnd: close,
      exported: language === 'java' ? undefined : tokens.slice(modifierStart, keyword).some((token) => token.text === 'export'),
      async: tokens.slice(modifierStart, keyword).some((token) => token.text === 'async'),
      static: tokens.slice(modifierStart, keyword).some((token) => token.text === 'static'),
      visibility: visibility(tokens, modifierStart, keyword),
      signature: language === 'arkts' && kind === 'function' && params >= 0
        ? source.slice(tokens[params]!.start.offset, tokens[open]!.start.offset).trim()
        : undefined,
      returnType: language === 'arkts' && kind === 'function' && paramsEnd !== undefined
        ? (() => {
            const colon = findNext(tokens, paramsEnd + 1, ':', open);
            return colon < 0 ? undefined : tokens.slice(colon + 1, open).find((item) => item.kind === 'identifier')?.text;
          })()
        : undefined,
    };
    declarations.push(declaration);
    return declaration;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    if (!TS_FAMILY_LANGUAGES.has(language) && language !== 'java') continue;
    const token = tokens[i]!;
    const nameIndex = token.text === 'function' && tokens[i + 1]?.text === '*' ? i + 2 : i + 1;
    const name = tokens[nameIndex];
    if (!name || name.kind !== 'identifier') continue;
    if (token.text === 'class') addBlockDeclaration('class', i, i + 1);
    else if (token.text === 'interface') addBlockDeclaration('interface', i, i + 1);
    else if (token.text === 'enum') addBlockDeclaration('enum', i, i + 1);
    else if (language === 'arkts' && token.text === 'struct') addBlockDeclaration('struct', i, i + 1);
    else if (token.text === 'function') addBlockDeclaration('function', i, nameIndex);
  }

  if (language === 'arkts') {
    for (let index = 0; index < declarations.length; index += 1) {
      const declaration = declarations[index]!;
      declarations[index] = { ...declaration, decorators: arktsDecorators(declaration.start) };
    }
  }

  if (language === 'java') {
    const javaTypes = declarations.filter((declaration) =>
      declaration.bodyStart !== undefined && ['class', 'interface', 'enum'].includes(declaration.kind));
    for (const parent of javaTypes) {
      const begin = parent.bodyStart! + 1;
      const end = parent.bodyEnd ?? tokens.length;
      for (let i = begin; i < end; i += 1) {
        if (tokens[i]!.text !== '=') continue;
        const nested = [...scan.pairs.entries()].some(([open, close]) =>
          tokens[open]?.text === '{' && open > parent.bodyStart! && close < end && open < i && close > i);
        if (nested) continue;
        let nameIndex = i - 1;
        while (nameIndex >= begin && tokens[nameIndex]!.kind !== 'identifier') nameIndex -= 1;
        let statementEnd = -1;
        for (let candidate = i + 1; candidate < end; candidate += 1) {
          if (tokens[candidate]!.text !== ';') continue;
          const nested = [...scan.pairs.entries()].some(([open, close]) =>
            open > i && open < candidate && close > candidate);
          if (!nested) { statementEnd = candidate; break; }
        }
        if (nameIndex < begin || statementEnd < 0) continue;
        let start = nameIndex;
        while (start > begin && ![';', '{', '}'].includes(tokens[start - 1]!.text)) start -= 1;
        declarations.push({
          kind: 'field', name: tokens[nameIndex]!.text, start, end: statementEnd,
          bodyStart: i, bodyEnd: statementEnd, parent,
          static: tokens.slice(start, nameIndex).some((token) => token.text === 'static'),
          visibility: visibility(tokens, start, nameIndex),
        });
        i = statementEnd;
      }
    }
  }

  const containers = declarations.filter((declaration) =>
    declaration.bodyStart !== undefined && ['class', 'interface', 'struct', 'trait', 'type_alias', 'constant', 'variable'].includes(declaration.kind));

  for (const parent of containers) {
    if (['rust', 'kotlin', 'scala'].includes(language)) continue;
    const begin = parent.bodyStart! + 1;
    const end = parent.bodyEnd ?? tokens.length;
    for (let i = begin; i < end; i += 1) {
      const name = tokens[i]!;
      const openParen = tokens[i + 1];
      if (tokens[i - 1]?.text === '@') continue;
      if (TS_FAMILY_LANGUAGES.has(language) &&
          ['class', 'interface', 'struct', 'type_alias'].includes(parent.kind) &&
          name.kind === 'identifier' && tokens[i + 1]?.text === ':') {
        const statementEnd = findNext(tokens, i + 2, ';', end);
        declarations.push({
          kind: 'property', name: name.text, start: i,
          end: statementEnd < 0 ? i + 1 : statementEnd, parent,
          decorators: arktsDecorators(i),
        });
        i = statementEnd < 0 ? i : statementEnd;
        continue;
      }
      if (parent.kind === 'constant' && parent.exported && name.kind === 'identifier' &&
          tokens[i + 1]?.text === ':') {
        const arrow = findNext(tokens, i + 2, '=>', end);
        if (arrow >= 0) {
          const nextComma = findNext(tokens, arrow + 1, ',', end);
          const bodyStart = tokens[arrow + 1]?.text === '{' ? arrow + 1 : arrow;
          const pairedBodyEnd = tokens[bodyStart]?.text === '{' ? scan.pairs.get(bodyStart) : undefined;
          declarations.push({
            kind: 'function', name: name.text, start: i,
            end: pairedBodyEnd ?? (nextComma < 0 ? end - 1 : nextComma - 1),
            bodyStart, bodyEnd: pairedBodyEnd ?? (nextComma < 0 ? end : nextComma), parent,
          });
          continue;
        }
      }
      if (name.kind !== 'identifier' || openParen?.text !== '(' ||
          (CALL_EXCLUSIONS.has(name.text) && !(language === 'arkts' && name.text === 'constructor'))) continue;
      const prior = previousWord(tokens, i);
      if (prior === 'function' || prior === 'fn' || prior === 'fun' || prior === 'def' || prior === 'new') continue;
      const closeParen = scan.pairs.get(i + 1);
      if (closeParen === undefined) continue;
      let terminator = closeParen + 1;
      while (terminator < end && tokens[terminator]!.text !== '{' && tokens[terminator]!.text !== ';') terminator += 1;
      const bodyStart = tokens[terminator]?.text === '{' ? terminator : -1;
      if (bodyStart < 0) {
        const start = declarationStart(tokens, i);
        const bodiless = parent.kind === 'interface' || parent.kind === 'type_alias' ||
          tokens.slice(start, i).some((item) => item.text === 'abstract' || item.text === 'native');
        if (bodiless) {
          const statementEnd = tokens[terminator]?.text === ';' ? terminator : -1;
          declarations.push({
            kind: 'method', name: name.text, start: i, end: statementEnd < 0 ? closeParen : statementEnd,
            parent, visibility: visibility(tokens, declarationStart(tokens, i), i),
          });
        }
        continue;
      }
      const bodyEnd = scan.pairs.get(bodyStart);
      if (bodyEnd === undefined || bodyEnd > end) continue;
      const start = declarationStart(tokens, i);
      let memberStart = start;
      if (language === 'java') {
        while (memberStart > begin && tokens[memberStart - 1]!.start.line === name.start.line &&
               ![';', '{', '}'].includes(tokens[memberStart - 1]!.text)) memberStart -= 1;
      }
      declarations.push({
        kind: 'method',
        name: name.text,
        start: memberStart,
        end: bodyEnd,
        bodyStart,
        bodyEnd,
        parent,
        async: tokens.slice(start, i).some((item) => item.text === 'async'),
        static: tokens.slice(memberStart, i).some((item) => item.text === 'static'),
        visibility: visibility(tokens, memberStart, i),
        decorators: arktsDecorators(memberStart),
        signature: language === 'arkts'
          ? source.slice(openParen.start.offset, tokens[bodyStart]!.start.offset).trim()
          : undefined,
        returnType: language === 'arkts' ? (() => {
          const colon = findNext(tokens, closeParen + 1, ':', bodyStart);
          if (colon < 0) return undefined;
          return tokens.slice(colon + 1, bodyStart).find((item) => item.kind === 'identifier')?.text;
        })() : undefined,
      });
      i = bodyEnd;
    }
  }

  if (TS_FAMILY_LANGUAGES.has(language)) {
    for (const parent of declarations.filter((item) => item.kind === 'enum' && item.bodyStart !== undefined && item.bodyEnd !== undefined)) {
      let cursor = parent.bodyStart! + 1;
      while (cursor < parent.bodyEnd!) {
        const token = tokens[cursor]!;
        if (token.kind === 'identifier' && (tokens[cursor - 1]?.text === '{' || tokens[cursor - 1]?.text === ',')) {
          declarations.push({ kind: 'enum_member', name: token.text, start: cursor, end: cursor, parent });
        }
        cursor += 1;
      }
    }
  }

  if (language === 'java') {
    for (let i = 0; i < tokens.length - 3; i += 1) {
      if (tokens[i]!.text !== 'new') continue;
      let typeIndex = i + 1;
      let base: NativeToken | undefined;
      while (typeIndex < tokens.length && tokens[typeIndex]!.text !== '(') {
        if (tokens[typeIndex]!.kind === 'identifier') base = tokens[typeIndex];
        typeIndex += 1;
      }
      if (!base || tokens[typeIndex]?.text !== '(') continue;
      const argsEnd = scan.pairs.get(typeIndex);
      if (argsEnd === undefined || tokens[argsEnd + 1]?.text !== '{') continue;
      const bodyStart = argsEnd + 1;
      const bodyEnd = scan.pairs.get(bodyStart);
      if (bodyEnd === undefined) continue;
      const parent = declarations
        .filter((declaration) => declaration.start <= i && declaration.end >= bodyEnd)
        .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
      const anonymous: Declaration = {
        kind: 'class', name: `<${base.text}$anon@${base.start.line}:${base.start.column}>`,
        start: base === tokens[typeIndex - 1] ? typeIndex - 1 : i + 1,
        end: bodyEnd, bodyStart, bodyEnd, parent, extendsName: base.text,
      };
      declarations.push(anonymous);
      for (let memberIndex = bodyStart + 1; memberIndex < bodyEnd; memberIndex += 1) {
        const memberName = tokens[memberIndex]!;
        if (memberName.kind !== 'identifier' || tokens[memberIndex + 1]?.text !== '(' ||
            CALL_EXCLUSIONS.has(memberName.text)) continue;
        const paramsEnd = scan.pairs.get(memberIndex + 1);
        if (paramsEnd === undefined) continue;
        let terminator = paramsEnd + 1;
        while (terminator < bodyEnd && !['{', ';'].includes(tokens[terminator]!.text)) terminator += 1;
        if (tokens[terminator]?.text !== '{') continue;
        const memberEnd = scan.pairs.get(terminator);
        if (memberEnd === undefined || memberEnd > bodyEnd) continue;
        const existingIndex = declarations.findIndex((declaration) =>
          declaration.kind === 'method' && declaration.name === memberName.text && declaration.start <= memberIndex && declaration.end === memberEnd);
        if (existingIndex >= 0) {
          declarations[existingIndex] = { ...declarations[existingIndex]!, parent: anonymous };
        } else {
          let memberStart = memberIndex;
          while (memberStart > bodyStart + 1 && tokens[memberStart - 1]!.start.line === memberName.start.line &&
                 ![';', '{', '}'].includes(tokens[memberStart - 1]!.text)) memberStart -= 1;
          declarations.push({
            kind: 'method', name: memberName.text, start: memberStart, end: memberEnd,
            bodyStart: terminator, bodyEnd: memberEnd, parent: anonymous,
            static: tokens.slice(memberStart, memberIndex).some((token) => token.text === 'static'),
            visibility: visibility(tokens, memberStart, memberIndex),
          });
        }
        memberIndex = memberEnd;
      }
      for (let j = 0; j < declarations.length; j += 1) {
        const declaration = declarations[j]!;
        if (declaration !== anonymous && declaration.kind === 'method' &&
            declaration.start > bodyStart && declaration.end < bodyEnd) {
          declarations[j] = { ...declaration, parent: anonymous };
        }
      }
      i = bodyEnd;
    }
  }

  for (let i = declarations.length - 1; i >= 0; i -= 1) {
    const declaration = declarations[i]!;
    if (declaration.kind !== 'constant' && declaration.kind !== 'variable') continue;
    const enclosingCallable = declarations.some((candidate) =>
      candidate !== declaration && (candidate.kind === 'function' || candidate.kind === 'method') &&
      candidate.bodyStart !== undefined && candidate.bodyStart < declaration.start && candidate.end >= declaration.end);
    if (enclosingCallable) declarations.splice(i, 1);
  }

  if (language === 'java' || language === 'kotlin' || language === 'scala') {
    const namespace = declarations.find((declaration) => declaration.kind === 'namespace');
    if (namespace) {
      const replacements = new Map<Declaration, Declaration>();
      for (let i = 0; i < declarations.length; i += 1) {
        const declaration = declarations[i]!;
        if (!declaration.parent && ['class', 'interface', 'enum', 'trait', 'function', 'constant', 'variable', 'type_alias'].includes(declaration.kind)) {
          const replacement = { ...declaration, parent: namespace };
          declarations[i] = replacement;
          replacements.set(declaration, replacement);
        }
      }
      for (let i = 0; i < declarations.length; i += 1) {
        const declaration = declarations[i]!;
        const replacement = declaration.parent && replacements.get(declaration.parent);
        if (replacement) {
          const updated = { ...declaration, parent: replacement };
          declarations[i] = updated;
          replacements.set(declaration, updated);
        }
      }
    }
  }

  declarations.sort((left, right) => left.start - right.start || right.end - left.end);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const refs: UnresolvedReference[] = [];
  const fileNode: Node = {
    id: `file:${filePath}`, kind: 'file', name: path.basename(filePath), qualifiedName: filePath,
    filePath, language, startLine: 1, endLine: source.split('\n').length,
    startColumn: 0, endColumn: 0, isExported: false, updatedAt: Date.now(),
  };
  nodes.push(fileNode);
  const nodeByDeclaration = new Map<Declaration, Node>();

  for (const declaration of declarations) {
    const start = tokens[declaration.start]!;
    const end = tokens[declaration.end] ?? start;
    const parentNode = declaration.parent ? nodeByDeclaration.get(declaration.parent) : undefined;
    const qualifiedName = parentNode
      ? `${parentNode.qualifiedName}::${declaration.name}`
      : declaration.name;
    const node: Node = {
      id: generateNodeId(filePath, declaration.kind, declaration.name, start.start.line),
      kind: declaration.kind, name: declaration.name, qualifiedName, filePath, language,
      startLine: start.start.line, endLine: tokenEndLine(end),
      startColumn: start.start.column, endColumn: end.end.column,
      isExported: declaration.exported,
      isAsync: declaration.async || undefined,
      isStatic: declaration.static || undefined,
      visibility: declaration.visibility,
      returnType: declaration.returnType,
      decorators: declaration.decorators,
      signature: declaration.signature ?? (declaration.bodyStart === undefined
        ? undefined
        : source.slice(start.start.offset, tokens[declaration.bodyStart]!.start.offset).trim()),
      docstring: precedingDoc(tokens, declaration),
      updatedAt: Date.now(),
    };
    nodes.push(node);
    nodeByDeclaration.set(declaration, node);
    edges.push({ source: parentNode?.id ?? fileNode.id, target: node.id, kind: 'contains' });
    if (declaration.extendsName) {
      refs.push({
        fromNodeId: node.id, referenceName: declaration.extendsName, referenceKind: 'extends',
        line: start.start.line, column: start.start.column,
      });
    }
  }

  if (TYPED_TS_FAMILY_LANGUAGES.has(language)) {
    for (const declaration of declarations) {
      if (declaration.kind !== 'type_alias' || declaration.bodyStart === undefined || declaration.bodyEnd === undefined) continue;
      const aliasNode = nodeByDeclaration.get(declaration);
      if (!aliasNode || tokens[declaration.bodyStart]?.text !== '[') continue;
      for (let i = declaration.bodyStart + 1; i < declaration.bodyEnd - 2; i += 1) {
        if (tokens[i]!.kind !== 'identifier' || tokens[i + 1]?.text !== '<' || tokens[i + 2]?.kind !== 'string') continue;
        const literal = tokens[i + 2]!;
        const name = literal.text.slice(1, -1);
        if (!/^[A-Za-z_]\w*$/.test(name)) continue;
        let depth = 0;
        let end = i + 2;
        for (let j = i + 1; j < declaration.bodyEnd; j += 1) {
          if (tokens[j]!.text === '<') depth += 1;
          else if (tokens[j]!.text === '>') {
            depth -= 1;
            if (depth === 0) { end = j; break; }
          }
        }
        const node: Node = {
          id: generateNodeId(filePath, 'method', name, literal.start.line), kind: 'method', name,
          qualifiedName: `${aliasNode.qualifiedName}::${name}`, filePath, language,
          startLine: tokens[i]!.start.line, endLine: tokens[end]!.end.line,
          startColumn: tokens[i]!.start.column, endColumn: tokens[end]!.end.column,
          signature: source.slice(tokens[i]!.start.offset, tokens[end]!.end.offset), updatedAt: Date.now(),
        };
        nodes.push(node);
        edges.push({ source: aliasNode.id, target: node.id, kind: 'contains' });
        i = end;
      }
    }
  }

  const ownerAt = (tokenIndex: number): Node => {
    const owners = declarations
      .filter((item) => item.start <= tokenIndex && item.end >= tokenIndex)
      .sort((left, right) => {
        const leftCallable = left.kind === 'function' || left.kind === 'method' ? 0 : 1;
        const rightCallable = right.kind === 'function' || right.kind === 'method' ? 0 : 1;
        return leftCallable - rightCallable || (left.end - left.start) - (right.end - right.start);
      });
    return (owners[0] && nodeByDeclaration.get(owners[0])) ?? fileNode;
  };

  if ([...TS_FAMILY_LANGUAGES, 'python', 'go', 'java', 'rust', 'kotlin', 'scala'].includes(language)) {
    const definedHere = new Set(declarations
      .filter((declaration) => declaration.kind === 'function' || declaration.kind === 'method' ||
        (language === 'python' && declaration.kind === 'class'))
      .map((declaration) => declaration.name));
    const seen = new Set<string>();
    const emitFunctionRef = (from: Node, name: string, token: NativeToken): void => {
      const key = `${from.id}\0${name}`;
      if (seen.has(key)) return;
      seen.add(key);
      refs.push({
        fromNodeId: from.id, referenceName: name, referenceKind: 'function_ref',
        line: token.start.line, column: token.start.column,
      });
    };

    if (language === 'java') {
      for (let i = 0; i < tokens.length - 2; i += 1) {
        const receiver = tokens[i]!;
        const member = tokens[i + 2]!;
        if (tokens[i + 1]?.text !== '::' || member.kind !== 'identifier') continue;
        if (receiver.text === 'this' || receiver.text === 'super') {
          emitFunctionRef(ownerAt(i), `this.${member.text}`, member);
        } else if (receiver.kind === 'identifier' && /^[A-Z]/.test(receiver.text) && member.text !== 'new') {
          emitFunctionRef(ownerAt(i), `${receiver.text}::${member.text}`, member);
        }
      }
    } else if (language === 'kotlin') {
      for (let i = 0; i < tokens.length - 1; i += 1) {
        if (tokens[i]!.text !== '::' || tokens[i + 1]?.kind !== 'identifier') continue;
        const member = tokens[i + 1]!;
        const receiver = tokens[i - 1]?.kind === 'identifier' ? tokens[i - 1] : undefined;
        emitFunctionRef(ownerAt(i), receiver ? `${receiver.text}::${member.text}` : member.text, member);
      }
    } else {
      const valueIntroducers = new Set(['(', ',', ':', '=', '[', '{', 'return']);
      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i]!;
        if (token.kind !== 'identifier') continue;
        if (TS_FAMILY_LANGUAGES.has(language) &&
            token.text === 'this' && tokens[i + 1]?.text === '.' && tokens[i + 2]?.kind === 'identifier') {
          const member = tokens[i + 2]!;
          if (tokens[i + 3]?.text !== '(') emitFunctionRef(ownerAt(i), `this.${member.text}`, member);
          continue;
        }
        if (!definedHere.has(token.text) && !importedNames.has(token.text)) continue;
        if (tokens.slice(0, i).some((item) => item.start.line === token.start.line &&
            (item.text === 'import' || (language === 'rust' && item.text === 'use')))) continue;
        if (tokens[i + 1]?.text === '(' || tokens[i - 1]?.text === '.' || tokens[i - 1]?.text === 'function' ||
            tokens[i - 1]?.text === 'def' || tokens[i - 1]?.text === 'class') continue;
        const previous = tokens[i - 1]?.text;
        if (!previous || !valueIntroducers.has(previous)) continue;
        const owner = ownerAt(i);
        if (language === 'python' && (owner.kind === 'variable' || owner.kind === 'constant')) {
          if (previous === ':') emitFunctionRef(owner, token.text, token);
          emitFunctionRef(fileNode, token.text, token);
        } else {
          emitFunctionRef(owner, token.text, token);
        }
      }
      if (language === 'rust') {
        for (let i = 1; i < tokens.length - 1; i += 1) {
          if (tokens[i]!.text !== '::' || tokens[i - 1]?.kind !== 'identifier' || tokens[i + 1]?.kind !== 'identifier') continue;
          if (tokens[i + 2]?.text === '(' || tokens[i + 2]?.text === '::') continue;
          const lineTokens = tokens.slice(0, i).filter((token) => token.start.line === tokens[i]!.start.line);
          if (lineTokens.some((token) => token.text === 'use' || token.text === '->')) continue;
          const context = tokens[i - 2]?.text;
          if (context && !['=', '(', ',', '[', '{', 'return'].includes(context)) continue;
          emitFunctionRef(ownerAt(i), `${tokens[i - 1]!.text}::${tokens[i + 1]!.text}`, tokens[i + 1]!);
        }
      }
    }
  }

  if (TS_FAMILY_LANGUAGES.has(language)) {
    for (const declaration of declarations) {
      if (!['class', 'interface', 'struct'].includes(declaration.kind) || declaration.bodyStart === undefined) continue;
      const from = nodeByDeclaration.get(declaration);
      if (!from) continue;
      let relation: 'extends' | 'implements' | undefined;
      for (let i = declaration.start + 1; i < declaration.bodyStart; i += 1) {
        if (tokens[i]!.text === 'extends' || tokens[i]!.text === 'implements') {
          relation = tokens[i]!.text as 'extends' | 'implements';
          continue;
        }
        if (!relation || tokens[i]!.kind !== 'identifier' || tokens[i]!.text === declaration.name) continue;
        refs.push({
          fromNodeId: from.id, referenceName: tokens[i]!.text, referenceKind: relation,
          line: tokens[i]!.start.line, column: tokens[i]!.start.column,
        });
      }
    }
    const seenTypeRefs = new Set<string>();
    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i]!.text !== ':') continue;
      const owner = ownerAt(i);
      for (let j = i + 1; j < tokens.length; j += 1) {
        const token = tokens[j]!;
        if (['=', ';', '{', '}', '=>'].includes(token.text)) break;
        if (token.kind !== 'identifier' || !/^[A-Z]/.test(token.text) || token.text === owner.name) continue;
        const key = `${owner.id}\0${token.text}\0${token.start.offset}`;
        if (seenTypeRefs.has(key)) continue;
        seenTypeRefs.add(key);
        refs.push({
          fromNodeId: owner.id, referenceName: token.text, referenceKind: 'references',
          line: token.start.line, column: token.start.column,
        });
      }
    }
  }

  if (TS_FAMILY_LANGUAGES.has(language)) {
    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i]!.text === 'new') {
        let cursor = i + 1;
        let lastIdentifier: NativeToken | undefined;
        let genericDepth = 0;
        while (cursor < tokens.length && !['(', ';', '{'].includes(tokens[cursor]!.text)) {
          if (tokens[cursor]!.text === '<') genericDepth += 1;
          else if (tokens[cursor]!.text === '>') genericDepth = Math.max(0, genericDepth - 1);
          else if (tokens[cursor]!.kind === 'identifier' && genericDepth === 0) lastIdentifier = tokens[cursor];
          cursor += 1;
        }
        if (lastIdentifier) {
          refs.push({
            fromNodeId: ownerAt(i).id, referenceName: lastIdentifier.text, referenceKind: 'instantiates',
            line: lastIdentifier.start.line, column: lastIdentifier.start.column,
          });
        }
      }
      if (tokens[i]!.text === '@' && tokens[i + 1]!.kind === 'identifier') {
        const decorated = declarations
          .filter((item) => item.start > i && tokens[item.start]!.start.line - tokens[i]!.start.line <= 2)
          .sort((left, right) => left.start - right.start)[0];
        const owner = decorated && nodeByDeclaration.get(decorated);
        if (owner) {
          refs.push({
            fromNodeId: owner.id, referenceName: tokens[i + 1]!.text, referenceKind: 'decorates',
            line: tokens[i]!.start.line, column: tokens[i]!.start.column,
          });
        }
      }
    }
  }


  if (language === 'java') {
    for (const declaration of declarations) {
      if (!['class', 'interface', 'enum'].includes(declaration.kind) || declaration.bodyStart === undefined) continue;
      const from = nodeByDeclaration.get(declaration);
      if (!from) continue;
      let relation: 'extends' | 'implements' | undefined;
      for (let i = declaration.start + 1; i < declaration.bodyStart; i += 1) {
        if (tokens[i]!.text === 'extends' || tokens[i]!.text === 'implements') {
          relation = tokens[i]!.text as 'extends' | 'implements';
          continue;
        }
        if (!relation || tokens[i]!.kind !== 'identifier' || tokens[i]!.text === declaration.name) continue;
        refs.push({
          fromNodeId: from.id, referenceName: tokens[i]!.text, referenceKind: relation,
          line: tokens[i]!.start.line, column: tokens[i]!.start.column,
        });
      }
    }
    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i]!.text !== 'new') continue;
      let cursor = i + 1;
      let typeName: NativeToken | undefined;
      while (cursor < tokens.length && tokens[cursor]!.text !== '(') {
        if (tokens[cursor]!.kind === 'identifier') typeName = tokens[cursor];
        cursor += 1;
      }
      if (!typeName) continue;
      refs.push({
        fromNodeId: ownerAt(i).id, referenceName: typeName.text, referenceKind: 'instantiates',
        line: typeName.start.line, column: typeName.start.column,
      });
    }
    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i]!.text !== '@' || tokens[i + 1]!.kind !== 'identifier' || tokens[i + 1]!.text === 'interface') continue;
      const decorated = declarations
        .filter((declaration) => declaration.start > i && tokens[declaration.start]!.start.line - tokens[i]!.start.line <= 3)
        .sort((left, right) => left.start - right.start)[0];
      const owner = decorated && nodeByDeclaration.get(decorated);
      if (!owner) continue;
      refs.push({
        fromNodeId: owner.id, referenceName: tokens[i + 1]!.text, referenceKind: 'decorates',
        line: tokens[i]!.start.line, column: tokens[i]!.start.column,
      });
    }
    for (let i = 0; i < tokens.length - 2; i += 1) {
      const receiver = tokens[i]!;
      if (receiver.kind !== 'identifier' || !/^[A-Z]/.test(receiver.text) ||
          tokens[i + 1]?.text !== '.' || tokens[i + 2]?.kind !== 'identifier') continue;
      const linePrefix = tokens.slice(0, i).filter((token) => token.start.line === receiver.start.line);
      if (linePrefix.some((token) => token.text === 'package' || token.text === 'import')) continue;
      refs.push({
        fromNodeId: ownerAt(i).id, referenceName: receiver.text, referenceKind: 'references',
        line: receiver.start.line, column: receiver.start.column,
      });
    }
  }

  if (language === 'rust') {
    const typeDeclarations = declarations.filter((item) => ['struct', 'union', 'enum', 'trait'].includes(item.kind));
    for (const declaration of typeDeclarations) {
      const from = nodeByDeclaration.get(declaration);
      if (!from || declaration.bodyStart === undefined) continue;
      if (declaration.kind === 'trait') {
        const colon = findNext(tokens, declaration.start + 1, ':', declaration.bodyStart);
        if (colon >= 0) {
          for (let i = colon + 1; i < declaration.bodyStart; i += 1) {
            const token = tokens[i]!;
            if (token.kind !== 'identifier' || ['where', 'for'].includes(token.text)) continue;
            refs.push({
              fromNodeId: from.id, referenceName: token.text, referenceKind: 'extends',
              line: token.start.line, column: token.start.column,
            });
          }
        }
      }
    }
    for (const impl of rustImpls) {
      if (!impl.typeName || !impl.traitName) continue;
      const owner = typeDeclarations.find((item) => item.name === impl.typeName && item.kind !== 'trait');
      const from = owner && nodeByDeclaration.get(owner);
      if (!from) continue;
      refs.push({
        fromNodeId: from.id, referenceName: impl.traitName, referenceKind: 'implements',
        line: tokens[impl.keyword]!.start.line, column: tokens[impl.keyword]!.start.column,
      });
    }
  }

  if (language === 'kotlin' || language === 'scala') {
    const builtins = new Set(language === 'kotlin'
      ? ['Any', 'Unit', 'Nothing', 'String', 'Int', 'Long', 'Short', 'Byte', 'Float', 'Double', 'Boolean', 'Char']
      : ['Int', 'Long', 'Short', 'Byte', 'Float', 'Double', 'Boolean', 'Char', 'Unit', 'String', 'Any', 'AnyRef', 'AnyVal', 'Nothing', 'Null']);
    for (const declaration of declarations) {
      const from = nodeByDeclaration.get(declaration);
      if (!from) continue;
      if (['class', 'interface', 'trait', 'enum'].includes(declaration.kind) && declaration.bodyStart !== undefined) {
        const marker = language === 'kotlin'
          ? findNext(tokens, declaration.start + 1, ':', declaration.bodyStart)
          : findNext(tokens, declaration.start + 1, 'extends', declaration.bodyStart);
        if (marker >= 0) {
          for (let i = marker + 1; i < declaration.bodyStart; i += 1) {
            const token = tokens[i]!;
            if (token.kind !== 'identifier' || builtins.has(token.text) ||
                ['with', 'by', 'where'].includes(token.text) || token.text === declaration.name) continue;
            refs.push({
              fromNodeId: from.id, referenceName: token.text, referenceKind: 'extends',
              line: token.start.line, column: token.start.column,
            });
          }
        }
      }
      if (declaration.kind === 'function' || declaration.kind === 'method') {
        const headerEnd = declaration.bodyStart ?? declaration.end + 1;
        const seenTypes = new Set<string>();
        for (let i = declaration.start + 1; i < headerEnd; i += 1) {
          const token = tokens[i]!;
          if (token.kind !== 'identifier' || !/^[A-Z]/.test(token.text) || builtins.has(token.text) ||
              token.text === declaration.name || seenTypes.has(token.text)) continue;
          seenTypes.add(token.text);
          refs.push({
            fromNodeId: from.id, referenceName: token.text, referenceKind: 'references',
            line: token.start.line, column: token.start.column,
          });
        }
      }
      if (!['field', 'constant', 'variable'].includes(declaration.kind)) continue;
      const colon = findNext(tokens, declaration.start + 1, ':', declaration.bodyStart ?? declaration.end + 1);
      if (colon < 0) continue;
      for (let i = colon + 1; i < (declaration.bodyStart ?? declaration.end + 1); i += 1) {
        const token = tokens[i]!;
        if (token.kind !== 'identifier' || builtins.has(token.text)) continue;
        refs.push({
          fromNodeId: from.id, referenceName: token.text, referenceKind: 'references',
          line: token.start.line, column: token.start.column,
        });
      }
    }
  }

  for (const declaration of declarations) {
    const callable = declaration.kind === 'function' || declaration.kind === 'method';
    const value = declaration.kind === 'constant' || declaration.kind === 'variable' || declaration.kind === 'field';
    if (!callable && !value) continue;
    const scanStart = declaration.bodyStart ?? (value ? declaration.start : undefined);
    const scanEnd = declaration.bodyEnd ?? (value ? declaration.end : undefined);
    if (scanStart === undefined || scanEnd === undefined) continue;
    const from = nodeByDeclaration.get(declaration);
    if (!from) continue;
    for (let i = scanStart + 1; i < scanEnd; i += 1) {
      const callee = tokens[i]!;
      if (callee.kind !== 'identifier' || tokens[i + 1]?.text !== '(' ||
          (CALL_EXCLUSIONS.has(callee.text) && !(language === 'rust' && callee.text === 'new' && tokens[i - 1]?.text === '::'))) continue;
      if (declarations.some((item) => item !== declaration && item.start === i)) continue;
      if (declarations.some((item) => item.parent === declaration && item.start <= i && item.end >= i)) continue;
      if (declarations.some((item) => item !== declaration && item.start > declaration.start &&
          item.end <= declaration.end && item.start <= i && item.end >= i)) continue;
      const receiver = tokens[i - 2]?.kind === 'identifier' && tokens[i - 1]?.text === '.' ? tokens[i - 2] : undefined;
      const rustPath = language === 'rust' && tokens[i - 2]?.kind === 'identifier' && tokens[i - 1]?.text === '::'
        ? tokens[i - 2]
        : undefined;
      let rustPathName: string | undefined;
      if (rustPath) {
        let pathStart = i - 2;
        while (pathStart >= 2 && tokens[pathStart - 1]?.text === '::' && tokens[pathStart - 2]?.kind === 'identifier') pathStart -= 2;
        rustPathName = tokens.slice(pathStart, i + 1).map((token) => token.text).join('');
      }
      const rustSelfField = language === 'rust' && receiver && tokens[i - 4]?.text === 'self' &&
        tokens[i - 3]?.text === '.' ? `self.${receiver.text}.${callee.text}` : undefined;
      const rustDeepChain = language === 'rust' && receiver && tokens[i - 3]?.text === '.' &&
        tokens[i - 4]?.text !== 'self';
      const arktsMember = language === 'arkts' && tokens[i - 1]?.text === '.'
        ? receiver?.text === 'this'
          ? callee.text
          : receiver
            ? `${receiver.text}.${callee.text}`
            : `.${callee.text}`
        : undefined;
      refs.push({
        fromNodeId: from.id,
        referenceName: arktsMember ?? rustSelfField ?? (rustDeepChain ? callee.text : rustPathName ?? (receiver ? `${receiver.text}.${callee.text}` : callee.text)),
        referenceKind: 'calls', line: callee.start.line,
        column: rustSelfField ? tokens[i - 4]!.start.column : rustPath?.start.column ?? receiver?.start.column ?? callee.start.column,
      });
      if (language === 'arkts') {
        const argsStart = i + 1;
        const argsEnd = scan.pairs.get(argsStart);
        if (argsEnd !== undefined) {
          for (let cursor = argsStart + 1; cursor < argsEnd - 1; cursor += 1) {
            if (tokens[cursor]!.text !== 'this' || tokens[cursor + 1]?.text !== '.' ||
                tokens[cursor + 2]?.kind !== 'identifier' || tokens[cursor + 3]?.text === '(') continue;
            const handler = tokens[cursor + 2]!;
            refs.push({
              fromNodeId: from.id, referenceName: handler.text, referenceKind: 'calls',
              line: handler.start.line, column: handler.start.column,
            });
          }
        }
      }
    }
    if (language === 'go') {
      for (let i = declaration.start + 1; i < (declaration.bodyStart ?? declaration.end); i += 1) {
        const typeToken = tokens[i]!;
        if (typeToken.kind !== 'identifier' || !/^[A-Z]/.test(typeToken.text) || typeToken.text === declaration.name) continue;
        refs.push({
          fromNodeId: from.id, referenceName: typeToken.text, referenceKind: 'references',
          line: typeToken.start.line, column: typeToken.start.column,
        });
      }
    }
  }

  if (language === 'rust') {
    const seen = new Set(refs.filter((ref) => ref.referenceKind === 'calls')
      .map((ref) => `${ref.fromNodeId}\0${ref.referenceName}\0${ref.line}\0${ref.column}`));
    for (let i = 0; i < tokens.length - 3; i += 1) {
      if (!['routes', 'catchers'].includes(tokens[i]!.text) || tokens[i + 1]?.text !== '!' || tokens[i + 2]?.text !== '[') continue;
      const close = scan.pairs.get(i + 2);
      if (close === undefined) continue;
      let segmentStart = i + 3;
      for (let cursor = segmentStart; cursor <= close; cursor += 1) {
        if (cursor < close && tokens[cursor]!.text !== ',') continue;
        const candidate = tokens.slice(segmentStart, cursor).filter((token) => token.kind === 'identifier').at(-1);
        if (candidate) {
          const from = ownerAt(i);
          const key = `${from.id}\0${candidate.text}\0${candidate.start.line}\0${candidate.start.column}`;
          if (!seen.has(key)) {
            seen.add(key);
            refs.push({
              fromNodeId: from.id, referenceName: candidate.text, referenceKind: 'calls',
              line: candidate.start.line, column: candidate.start.column,
            });
          }
        }
        segmentStart = cursor + 1;
      }
      i = close;
    }
  }

  if (language === 'kotlin') {
    const seenCalls = new Set(refs.filter((ref) => ref.referenceKind === 'calls')
      .map((ref) => `${ref.fromNodeId}\0${ref.referenceName}\0${ref.line}\0${ref.column}`));
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const callee = tokens[i]!;
      if (callee.kind !== 'identifier' || tokens[i + 1]?.text !== '(' || CALL_EXCLUSIONS.has(callee.text)) continue;
      if (['fun', 'class', 'interface'].includes(tokens[i - 1]?.text ?? '')) continue;
      const receiver = tokens[i - 2]?.kind === 'identifier' && tokens[i - 1]?.text === '.' ? tokens[i - 2] : undefined;
      const referenceName = receiver ? `${receiver.text}.${callee.text}` : callee.text;
      const column = receiver?.start.column ?? callee.start.column;
      const lexicalFrom = ownerAt(i);
      const from = lexicalFrom.kind === 'file'
        ? nodes.find((node) => node.kind === 'namespace') ?? lexicalFrom
        : lexicalFrom;
      const key = `${from.id}\0${referenceName}\0${callee.start.line}\0${column}`;
      if (seenCalls.has(key)) continue;
      seenCalls.add(key);
      refs.push({
        fromNodeId: from.id, referenceName, referenceKind: 'calls',
        line: callee.start.line, column,
      });
    }
  }

  if (language === 'python') {
    const seenCalls = new Set(refs
      .filter((ref) => ref.referenceKind === 'calls')
      .map((ref) => `${ref.referenceName}\0${ref.line}\0${ref.column}`));
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const callee = tokens[i]!;
      if (callee.kind !== 'identifier' || tokens[i + 1]?.text !== '(' || CALL_EXCLUSIONS.has(callee.text)) continue;
      if (tokens[i - 1]?.text === 'def' || tokens[i - 1]?.text === 'class') continue;
      const receiver = tokens[i - 2]?.kind === 'identifier' && tokens[i - 1]?.text === '.' ? tokens[i - 2] : undefined;
      const referenceName = receiver ? `${receiver.text}.${callee.text}` : callee.text;
      const column = receiver?.start.column ?? callee.start.column;
      const key = `${referenceName}\0${callee.start.line}\0${column}`;
      if (seenCalls.has(key)) continue;
      seenCalls.add(key);
      refs.push({
        fromNodeId: ownerAt(i).id, referenceName, referenceKind: 'calls',
        line: callee.start.line, column,
      });
    }
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const isImport = tokens[i]!.text === 'import';
    const isReExport = tokens[i]!.text === 'export' && tokens.slice(i + 1, i + 20).some((token) => token.text === 'from');
    if (!isImport && !isReExport) continue;
    let moduleToken: NativeToken | undefined;
    for (let j = i + 1; j < tokens.length && tokens[j]!.start.line === tokens[i]!.start.line; j += 1) {
      if (tokens[j]!.kind === 'string') moduleToken = tokens[j];
    }
    if (!moduleToken) continue;
    const importName = moduleToken.text.slice(1, -1);
    const importStart = language === 'go' ? moduleToken.start : tokens[i]!.start;
    const statementEndIndex = findNext(tokens, i + 1, ';');
    const statementEnd = statementEndIndex < 0 || tokens[statementEndIndex]!.start.line !== tokens[i]!.start.line
      ? moduleToken.end.offset
      : tokens[statementEndIndex]!.end.offset;
    const importNode: Node = {
      id: generateNodeId(filePath, 'import', importName, tokens[i]!.start.line),
      kind: 'import', name: importName, qualifiedName: importName, filePath, language,
      startLine: importStart.line, endLine: moduleToken.end.line,
      startColumn: importStart.column, endColumn: language === 'go' ? moduleToken.end.column : moduleToken.end.column + 1,
      signature: source.slice(tokens[i]!.start.offset, statementEnd),
      updatedAt: Date.now(),
    };
    nodes.push(importNode);
    edges.push({ source: fileNode.id, target: importNode.id, kind: 'contains' });
    refs.push({
      fromNodeId: fileNode.id,
      referenceName: importName,
      referenceKind: 'imports', line: tokens[i]!.start.line,
      column: language === 'go' ? moduleToken.start.column : tokens[i]!.start.column,
    });
    for (let j = i + 1; j < tokens.length && tokens[j] !== moduleToken; j += 1) {
      const binding = tokens[j]!;
      if (binding.kind !== 'identifier' || ['from', 'as', 'type'].includes(binding.text)) continue;
      refs.push({
        fromNodeId: fileNode.id, referenceName: binding.text, referenceKind: 'imports',
        line: binding.start.line, column: binding.start.column,
      });
    }
  }


  if (language === 'java') {
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i]!.text !== 'import') continue;
      const end = findNext(tokens, i + 1, ';');
      if (end < 0) continue;
      let start = i + 1;
      if (tokens[start]?.text === 'static') start += 1;
      const raw = tokens.slice(start, end)
        .filter((token) => token.kind === 'identifier' || token.text === '.' || token.text === '*')
        .map((token) => token.text).join('');
      const name = raw.replace(/\.\*$/, '');
      if (!name) continue;
      const importNode: Node = {
        id: generateNodeId(filePath, 'import', name, tokens[i]!.start.line),
        kind: 'import', name, qualifiedName: name, filePath, language,
        startLine: tokens[i]!.start.line, endLine: tokens[end]!.end.line,
        startColumn: tokens[i]!.start.column, endColumn: tokens[end]!.end.column,
        signature: source.slice(tokens[i]!.start.offset, tokens[end]!.end.offset), updatedAt: Date.now(),
      };
      nodes.push(importNode);
      edges.push({ source: fileNode.id, target: importNode.id, kind: 'contains' });
      refs.push({
        fromNodeId: fileNode.id, referenceName: name, referenceKind: 'imports',
        line: tokens[i]!.start.line, column: tokens[i]!.start.column,
      });
      i = end;
    }
  }

  if (language === 'go') {
    for (let i = 0; i < tokens.length - 1; i += 1) {
      if (tokens[i]!.text !== 'import' || tokens[i + 1]?.text !== '(') continue;
      const close = scan.pairs.get(i + 1);
      if (close === undefined) continue;
      for (let j = i + 2; j < close; j += 1) {
        const moduleToken = tokens[j]!;
        if (moduleToken.kind !== 'string') continue;
        const importName = moduleToken.text.slice(1, -1);
        const previous = tokens[j - 1];
        const alias = previous?.start.line === moduleToken.start.line &&
          (previous.kind === 'identifier' || ['.', '_'].includes(previous.text)) ? previous : undefined;
        const signatureStart = alias ?? moduleToken;
        const importNode: Node = {
          id: generateNodeId(filePath, 'import', importName, moduleToken.start.line),
          kind: 'import', name: importName, qualifiedName: importName, filePath, language,
          startLine: signatureStart.start.line, endLine: moduleToken.end.line,
          startColumn: signatureStart.start.column, endColumn: moduleToken.end.column,
          signature: source.slice(signatureStart.start.offset, moduleToken.end.offset), updatedAt: Date.now(),
        };
        nodes.push(importNode);
        edges.push({ source: fileNode.id, target: importNode.id, kind: 'contains' });
        refs.push({
          fromNodeId: fileNode.id, referenceName: importName, referenceKind: 'imports',
          line: moduleToken.start.line, column: moduleToken.start.column,
        });
      }
    }
  }

  if (language === 'python') {
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i]!.text === 'import') {
        const line = tokens[i]!.start.line;
        if (tokens.slice(0, i).some((token) => token.start.line === line && token.text === 'from')) continue;
        let cursor = i + 1;
        while (cursor < tokens.length && tokens[cursor]!.start.line === line) {
          const moduleStart = cursor;
          while (cursor < tokens.length && tokens[cursor]!.start.line === line && ![',', 'as'].includes(tokens[cursor]!.text)) cursor += 1;
          const moduleTokens = tokens.slice(moduleStart, cursor).filter((token) => token.kind === 'identifier' || token.text === '.');
          const moduleName = moduleTokens.map((token) => token.text).join('');
          let end = moduleTokens.at(-1) ?? tokens[moduleStart]!;
          if (tokens[cursor]?.text === 'as' && tokens[cursor + 1]?.start.line === line) {
            end = tokens[cursor + 1]!;
            cursor += 2;
          }
          if (moduleName) {
            const importNode: Node = {
              id: generateNodeId(filePath, 'import', moduleName, line), kind: 'import',
              name: moduleName, qualifiedName: moduleName, filePath, language,
              startLine: line, endLine: end.end.line, startColumn: tokens[i]!.start.column,
              endColumn: end.end.column, signature: source.slice(tokens[i]!.start.offset, end.end.offset),
              updatedAt: Date.now(),
            };
            nodes.push(importNode);
            edges.push({ source: fileNode.id, target: importNode.id, kind: 'contains' });
            refs.push({ fromNodeId: fileNode.id, referenceName: moduleName, referenceKind: 'imports', line, column: tokens[i]!.start.column });
          }
          if (tokens[cursor]?.text === ',') cursor += 1;
          else break;
        }
        continue;
      }
      if (tokens[i]!.text !== 'from') continue;
      const importIndex = findNext(tokens, i + 1, 'import');
      if (importIndex < 0 || tokens[importIndex]!.start.line !== tokens[i]!.start.line) continue;
      const moduleTokens = tokens.slice(i + 1, importIndex).filter((token) => token.kind === 'identifier' || token.text === '.');
      const moduleName = moduleTokens.map((token) => token.text).join('');
      if (!moduleName) continue;
      const lineTokens = tokens.slice(importIndex + 1).filter((token) => token.start.line === tokens[i]!.start.line);
      const last = lineTokens.at(-1) ?? moduleTokens.at(-1)!;
      const importNode: Node = {
        id: generateNodeId(filePath, 'import', moduleName, tokens[i]!.start.line),
        kind: 'import', name: moduleName, qualifiedName: moduleName,
        filePath, language, startLine: tokens[i]!.start.line, endLine: last.end.line,
        startColumn: tokens[i]!.start.column, endColumn: last.end.column, updatedAt: Date.now(),
        signature: source.slice(tokens[i]!.start.offset, last.end.offset),
      };
      nodes.push(importNode);
      edges.push({ source: fileNode.id, target: importNode.id, kind: 'contains' });
      refs.push({
        fromNodeId: fileNode.id, referenceName: moduleName, referenceKind: 'imports',
        line: tokens[i]!.start.line, column: tokens[i]!.start.column,
      });
      for (const binding of lineTokens) {
        if (binding.kind !== 'identifier' || binding.text === 'as') continue;
        refs.push({
          fromNodeId: fileNode.id, referenceName: binding.text, referenceKind: 'imports',
          line: binding.start.line, column: binding.start.column,
        });
      }
    }
  }

  if (language === 'rust' || language === 'kotlin' || language === 'scala') {
    const keyword = language === 'rust' ? 'use' : 'import';
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i]!.text !== keyword) continue;
      const end = statementEnd(i);
      const alias = language === 'kotlin' ? findNext(tokens, i + 1, 'as', end + 1) : -1;
      const pathTokens = tokens.slice(i + 1, alias >= 0 ? alias : end + 1)
        .filter((token) => token.kind === 'identifier' || ['.', '::'].includes(token.text));
      if (pathTokens.length === 0) continue;
      const fullName = pathTokens.map((token) => token.text).join('').replace(/(?:\.|::)+$/, '');
      const importName = language === 'rust' || language === 'scala'
        ? pathTokens.find((token) => token.kind === 'identifier')?.text ?? fullName
        : fullName;
      if (!importName) continue;
      const last = tokens[end] ?? pathTokens.at(-1)!;
      const importOwner = language === 'kotlin'
        ? nodes.find((node) => node.kind === 'namespace') ?? fileNode
        : fileNode;
      const importNode: Node = {
        id: generateNodeId(filePath, 'import', importName, tokens[i]!.start.line),
        kind: 'import', name: importName,
        qualifiedName: importOwner.kind === 'namespace' ? `${importOwner.qualifiedName}::${importName}` : importName,
        filePath, language,
        startLine: tokens[i]!.start.line, endLine: last.end.line,
        startColumn: tokens[i]!.start.column, endColumn: last.end.column,
        signature: source.slice(tokens[i]!.start.offset, last.end.offset), updatedAt: Date.now(),
      };
      nodes.push(importNode);
      edges.push({ source: importOwner.id, target: importNode.id, kind: 'contains' });
      refs.push({
        fromNodeId: importOwner.id, referenceName: importName, referenceKind: 'imports',
        line: tokens[i]!.start.line, column: tokens[i]!.start.column,
      });
      i = end;
    }
  }

  nodes.splice(1, nodes.length - 1, ...nodes.slice(1).sort((left, right) =>
    left.startLine - right.startLine || left.startColumn - right.startColumn || left.kind.localeCompare(right.kind)));
  const positions = new Map(nodes.map((node) => [node.id, [node.startLine, node.startColumn] as const]));
  edges.sort((left, right) => {
    const leftPosition = positions.get(left.target) ?? [0, 0];
    const rightPosition = positions.get(right.target) ?? [0, 0];
    return leftPosition[0] - rightPosition[0] || leftPosition[1] - rightPosition[1];
  });
  refs.sort((left, right) => left.line - right.line || left.column - right.column);

  return {
    nodes, edges, unresolvedReferences: refs,
    errors: scan.unterminated.map((kind) => ({
      message: `Incomplete ${kind} while scanning ${filePath}`,
      filePath, severity: 'warning' as const, code: 'native_incomplete_source',
    })),
    durationMs: Date.now() - started,
  };
}
