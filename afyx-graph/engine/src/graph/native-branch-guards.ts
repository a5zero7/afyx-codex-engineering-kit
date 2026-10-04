import { scanSource, type NativeToken } from '../extraction/native/scanner';
import type { Language } from '../types';
import type { BranchGuard, GuardExit, GuardForm } from './branch-guard-policy';

const NATIVE_GUARD_LANGUAGES: ReadonlySet<Language> = new Set([
  'typescript', 'tsx', 'javascript', 'jsx',
]);
const TEXT_LIMIT = 80;

interface Arm {
  start: number;
  end: number;
  after: number;
  open?: number;
}

interface IfShape {
  keyword: number;
  conditionStart: number;
  conditionEnd: number;
  consequence: Arm;
  alternative?: Arm;
}

interface NativeView {
  source: string;
  tokens: readonly NativeToken[];
  pairs: ReadonlyMap<number, number>;
  lineOffsets: readonly number[];
}

export function supportsNativeBranchGuards(language: Language): boolean {
  return NATIVE_GUARD_LANGUAGES.has(language);
}

function viewOf(source: string): NativeView {
  const scanned = scanSource(source, { hashComments: false });
  const tokens = scanned.tokens.filter((token) => token.kind !== 'comment');
  const pairs = new Map<number, number>();
  const stack: number[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const text = tokens[index]!.text;
    if (text === '(' || text === '[' || text === '{') stack.push(index);
    else if (text === ')' || text === ']' || text === '}') {
      const open = stack.at(-1);
      if (open !== undefined) {
        const expected = tokens[open]!.text === '(' ? ')' : tokens[open]!.text === '[' ? ']' : '}';
        if (text === expected) {
          stack.pop();
          pairs.set(open, index);
          pairs.set(index, open);
        }
      }
    }
  }
  const lineOffsets = [0];
  for (let offset = 0; offset < source.length; offset += 1) {
    if (source[offset] === '\n') lineOffsets.push(offset + 1);
  }
  return { source, tokens, pairs, lineOffsets };
}

function collapse(text: string): string {
  const value = text.replace(/\s+/g, ' ').trim().replace(/^\((.*)\)$/s, '$1').trim();
  return value.length > TEXT_LIMIT ? `${value.slice(0, TEXT_LIMIT - 1)}…` : value;
}

function slice(view: NativeView, first: number, lastExclusive: number): string {
  const start = view.tokens[first]?.start.offset;
  const end = view.tokens[lastExclusive - 1]?.end.offset;
  return start === undefined || end === undefined ? '' : collapse(view.source.slice(start, end));
}

function rawSlice(view: NativeView, first: number, lastExclusive: number): string {
  const start = view.tokens[first]?.start.offset;
  const end = view.tokens[lastExclusive - 1]?.end.offset;
  return start === undefined || end === undefined ? '' : view.source.slice(start, end);
}

function bodyAt(view: NativeView, start: number): Arm | null {
  const token = view.tokens[start];
  if (!token) return null;
  if (token.text === '{') {
    const close = view.pairs.get(start);
    return close === undefined ? null : { start: start + 1, end: close, after: close + 1, open: start };
  }
  if (token.text === 'if') {
    const nested = ifAt(view, start);
    if (nested) {
      const after = nested.alternative?.after ?? nested.consequence.after;
      return { start, end: after, after };
    }
  }
  let end = start + 1;
  const line = token.start.line;
  while (end < view.tokens.length) {
    const current = view.tokens[end]!;
    if (current.text === ';') return { start, end: end + 1, after: end + 1 };
    if (current.text === '}' || current.start.line > line) break;
    end += 1;
  }
  return { start, end, after: end };
}

function ifAt(view: NativeView, keyword: number): IfShape | null {
  if (view.tokens[keyword]?.text !== 'if') return null;
  const open = keyword + 1;
  if (view.tokens[open]?.text !== '(') return null;
  const close = view.pairs.get(open);
  if (close === undefined) return null;
  const consequence = bodyAt(view, close + 1);
  if (!consequence) return null;
  let next = consequence.after;
  while (view.tokens[next]?.text === ';') next += 1;
  const alternative = view.tokens[next]?.text === 'else' ? bodyAt(view, next + 1) ?? undefined : undefined;
  return { keyword, conditionStart: open + 1, conditionEnd: close, consequence, alternative };
}

function contains(view: NativeView, arm: Arm, offset: number): boolean {
  const start = view.tokens[arm.start]?.start.offset ?? view.tokens[arm.open ?? arm.start]?.end.offset ?? 0;
  const end = view.tokens[arm.end - 1]?.end.offset ?? view.tokens[arm.open ?? arm.end]?.start.offset ?? start;
  return offset >= start && offset < end;
}

function branchKey(token: NativeToken): string {
  return `${token.start.line}:${token.start.column}`;
}

function exitIn(view: NativeView, arm: Arm): GuardExit | null {
  const text = rawSlice(view, arm.start, arm.end).replace(/[;}\s]+$/g, '');
  const match = /(?:^|[;\n])\s*(return|throw|break|continue|yield)\b[^;\n]*$/s.exec(text);
  if (!match) return null;
  return match[1] === 'throw' ? 'throw' : 'return';
}

function guard(
  view: NativeView,
  form: GuardForm,
  text: string,
  negated: boolean,
  keyword: number,
  options: {
    armExit?: GuardExit | null;
    exit?: GuardExit | null;
    branchIndex?: number;
    lineIndex?: number | null;
  } = {},
): BranchGuard | null {
  const value = collapse(text);
  const branchToken = view.tokens[options.branchIndex ?? keyword];
  const lineToken = options.lineIndex === null ? null : view.tokens[options.lineIndex ?? keyword];
  if (!value || !branchToken) return null;
  return {
    text: value,
    negated,
    form,
    line: lineToken?.start.line ?? 0,
    branch: branchKey(branchToken),
    ...(options.armExit ? { armExit: options.armExit } : {}),
    ...(options.exit ? { exit: options.exit } : {}),
  };
}

function containingBrace(view: NativeView, tokenIndex: number): number | null {
  let found: number | null = null;
  for (const [open, close] of view.pairs) {
    if (open >= close || view.tokens[open]?.text !== '{') continue;
    if (open < tokenIndex && tokenIndex < close && (found === null || open > found)) found = open;
  }
  return found;
}

function functionBoundary(view: NativeView, siteToken: number): number {
  let boundary = -1;
  for (const [open, close] of view.pairs) {
    if (open >= close || view.tokens[open]?.text !== '{' || !(open < siteToken && siteToken < close)) continue;
    const before = view.tokens[open - 1]?.text;
    let named = false;
    if (before === ')') {
      const params = view.pairs.get(open - 1);
      if (params !== undefined) named = view.tokens[params - 2]?.text === 'function';
    } else if (before === '=>') {
      const floor = containingBrace(view, open) ?? 0;
      for (let index = open - 2; index >= floor; index -= 1) {
        const text = view.tokens[index]!.text;
        if (text === ';' || text === '{' || text === '}') break;
        if (text === '=' && ['const', 'let', 'var'].includes(view.tokens[index - 2]?.text ?? '')) {
          named = true;
          break;
        }
      }
    }
    if (named && open > boundary) boundary = open;
  }
  return boundary;
}

function tokenAtOffset(view: NativeView, offset: number): number {
  const found = view.tokens.findIndex((token) => token.start.offset <= offset && offset < token.end.offset);
  if (found >= 0) return found;
  const next = view.tokens.findIndex((token) => token.start.offset >= offset);
  return next >= 0 ? next : Math.max(0, view.tokens.length - 1);
}

function laterInContainingBlock(view: NativeView, first: number, second: number): boolean {
  const block = containingBrace(view, first);
  if (block === null) return true;
  const close = view.pairs.get(block);
  return close !== undefined && first < second && second < close;
}

function ifGuards(view: NativeView, siteOffset: number, siteToken: number, boundary: number): BranchGuard[] {
  const found: BranchGuard[] = [];
  for (let index = boundary + 1; index < view.tokens.length; index += 1) {
    if (view.tokens[index]!.text !== 'if') continue;
    const shape = ifAt(view, index);
    if (!shape) continue;
    const condition = slice(view, shape.conditionStart, shape.conditionEnd);
    if (contains(view, shape.consequence, siteOffset)) {
      const item = guard(view, 'if', condition, false, index, { armExit: exitIn(view, shape.consequence) });
      if (item) found.push(item);
      continue;
    }
    if (shape.alternative && contains(view, shape.alternative, siteOffset)) {
      const item = guard(view, 'else', condition, true, index, { armExit: exitIn(view, shape.alternative) });
      if (item) found.push(item);
      continue;
    }
    const after = shape.alternative?.after ?? shape.consequence.after;
    if (!shape.alternative && after <= siteToken && laterInContainingBlock(view, index, siteToken)) {
      const exit = exitIn(view, shape.consequence);
      if (exit) {
        const item = guard(view, 'guard', condition, true, index, { exit });
        if (item) found.push(item);
      }
    }
  }
  return found;
}

function catchGuards(view: NativeView, siteOffset: number, boundary: number): BranchGuard[] {
  const found: BranchGuard[] = [];
  for (let index = boundary + 1; index < view.tokens.length; index += 1) {
    if (view.tokens[index]!.text !== 'catch') continue;
    let body = index + 1;
    if (view.tokens[body]?.text === '(') body = (view.pairs.get(body) ?? body) + 1;
    const arm = bodyAt(view, body);
    if (!arm || !contains(view, arm, siteOffset)) continue;
    const item = guard(view, 'catch', 'on error', false, index, { armExit: exitIn(view, arm), lineIndex: null });
    if (item) found.push(item);
  }
  return found;
}

function switchGuards(view: NativeView, siteToken: number, boundary: number): BranchGuard[] {
  const found: BranchGuard[] = [];
  for (let index = boundary + 1; index < siteToken; index += 1) {
    if (view.tokens[index]!.text !== 'switch' || view.tokens[index + 1]?.text !== '(') continue;
    const conditionClose = view.pairs.get(index + 1);
    const blockOpen = conditionClose === undefined ? undefined : conditionClose + 1;
    const blockClose = blockOpen === undefined ? undefined : view.pairs.get(blockOpen);
    if (conditionClose === undefined || blockOpen === undefined || blockClose === undefined || siteToken >= blockClose) continue;
    const subject = slice(view, index + 2, conditionClose);
    let active: number | null = null;
    for (let cursor = blockOpen + 1; cursor < blockClose; cursor += 1) {
      if (view.tokens[cursor]!.text === 'case' || view.tokens[cursor]!.text === 'default') {
        if (cursor > siteToken) break;
        active = cursor;
      }
    }
    if (active === null) continue;
    const isDefault = view.tokens[active]!.text === 'default';
    let colon = active + 1;
    while (colon < blockClose && view.tokens[colon]!.text !== ':') colon += 1;
    const value = isDefault ? '' : slice(view, active + 1, colon);
    const item = guard(view, 'case', isDefault ? `${subject}: default` : `${subject} === ${value}`, false, index, {
      lineIndex: isDefault ? index : active,
    });
    if (item) found.push(item);
  }
  return found;
}

function statementStart(view: NativeView, index: number, boundary: number): number {
  let depth = 0;
  const line = view.tokens[index]?.start.line ?? 0;
  for (let cursor = index - 1; cursor > boundary; cursor -= 1) {
    const text = view.tokens[cursor]!.text;
    if (depth === 0 && text === '}') return cursor + 1;
    if (depth === 0 && view.tokens[cursor]!.end.line < line) return cursor + 1;
    if (text === ')' || text === ']' || text === '}') depth += 1;
    else if (text === '(' || text === '[' || text === '{') {
      if (depth > 0) depth -= 1;
      else return cursor + 1;
    } else if (depth === 0 && (text === ';' || text === '=' || text === 'return')) return cursor + 1;
  }
  return boundary + 1;
}

function ternaryGuards(view: NativeView, siteToken: number, boundary: number): BranchGuard[] {
  const found: BranchGuard[] = [];
  for (let question = boundary + 1; question < view.tokens.length; question += 1) {
    if (view.tokens[question]!.text !== '?') continue;
    let colon = question + 1;
    let nested = 0;
    for (; colon < view.tokens.length; colon += 1) {
      const text = view.tokens[colon]!.text;
      if (text === '?') nested += 1;
      else if (text === ':' && nested-- === 0) break;
      else if ((text === ';' || text === '}') && nested === 0) break;
    }
    if (view.tokens[colon]?.text !== ':') continue;
    let end = colon + 1;
    const questionLine = view.tokens[question]!.start.line;
    while (end < view.tokens.length && ![';', '}'].includes(view.tokens[end]!.text)
      && view.tokens[end]!.start.line === questionLine) end += 1;
    if (!(question < siteToken && siteToken < end)) continue;
    const conditionStart = statementStart(view, question, boundary);
    const condition = slice(view, conditionStart, question);
    const item = guard(view, 'ternary', condition, siteToken > colon, question, {
      branchIndex: conditionStart,
      lineIndex: conditionStart,
    });
    if (item) found.push(item);
  }
  return found;
}

function logicalGuards(view: NativeView, siteToken: number, boundary: number): BranchGuard[] {
  const found: BranchGuard[] = [];
  for (let operator = boundary + 1; operator < siteToken; operator += 1) {
    const text = view.tokens[operator]!.text;
    if (text !== '&&' && text !== '||') continue;
    const left = statementStart(view, operator, boundary);
    const rightEnd = (() => {
      let enclosingClose = view.tokens.length;
      let enclosed = false;
      for (const [open, close] of view.pairs) {
        if (view.tokens[open]?.text === '{') continue;
        if (open < operator && operator < close && close < enclosingClose) {
          enclosingClose = close;
          enclosed = true;
        }
      }
      let cursor = operator + 1;
      const operatorLine = view.tokens[operator]!.start.line;
      while (cursor < enclosingClose && ![';', ',', '}', '?', ':'].includes(view.tokens[cursor]!.text)) {
        if (!enclosed && view.tokens[cursor]!.start.line > operatorLine) break;
        cursor += 1;
      }
      return cursor;
    })();
    if (siteToken >= rightEnd) continue;
    const item = guard(view, text === '&&' ? 'and' : 'or', slice(view, left, operator), text === '||', operator, {
      branchIndex: left,
      lineIndex: left,
    });
    if (item) found.push(item);
  }
  return found;
}

function dedupeAndOrder(items: BranchGuard[]): BranchGuard[] {
  const unique = new Map<string, BranchGuard>();
  for (const item of items) unique.set(`${item.branch}:${item.form}:${item.negated}:${item.text}`, item);
  const branchLine = (item: BranchGuard): number => Number.parseInt(item.branch, 10) || item.line;
  return [...unique.values()].sort((left, right) => branchLine(left) - branchLine(right) || left.branch.localeCompare(right.branch));
}

function guardsInView(view: NativeView, line: number, column: number | null): BranchGuard[] {
  if (line < 1) return [];
  const lineStart = view.lineOffsets[line - 1];
  if (lineStart === undefined) return [];
  const lineEnd = view.source.indexOf('\n', lineStart);
  const sourceLine = view.source.slice(lineStart, lineEnd < 0 ? view.source.length : lineEnd);
  const resolvedColumn = column ?? Math.max(0, sourceLine.search(/\S/));
  const offset = lineStart + resolvedColumn;
  if (view.tokens.length === 0) return [];
  const siteToken = tokenAtOffset(view, offset);
  const boundary = functionBoundary(view, siteToken);
  return dedupeAndOrder([
    ...ifGuards(view, offset, siteToken, boundary),
    ...catchGuards(view, offset, boundary),
    ...switchGuards(view, siteToken, boundary),
    ...ternaryGuards(view, siteToken, boundary),
    ...logicalGuards(view, siteToken, boundary),
  ]);
}

export function createNativeBranchGuardReader(
  source: string,
  language: Language,
): (line: number, column: number | null) => BranchGuard[] {
  if (!supportsNativeBranchGuards(language)) return () => [];
  const view = viewOf(source);
  return (line, column) => guardsInView(view, line, column);
}

export function nativeGuardsInSource(source: string, language: Language, line: number, column: number | null): BranchGuard[] {
  return createNativeBranchGuardReader(source, language)(line, column);
}
