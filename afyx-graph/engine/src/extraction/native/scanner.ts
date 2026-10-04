export type NativeTokenKind = 'identifier' | 'number' | 'string' | 'punctuation';

export interface NativePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface NativeToken {
  readonly kind: NativeTokenKind;
  readonly text: string;
  readonly start: NativePosition;
  readonly end: NativePosition;
}

export interface NativeScanResult {
  readonly tokens: readonly NativeToken[];
  readonly pairs: ReadonlyMap<number, number>;
  readonly unterminated: readonly ('string' | 'comment' | 'delimiter')[];
}

const OPEN_TO_CLOSE: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };
const CLOSE = new Set(Object.values(OPEN_TO_CLOSE));

function isIdentifierStart(char: string): boolean {
  return /[$_\p{ID_Start}]/u.test(char);
}

function isIdentifierContinue(char: string): boolean {
  return /[$\u200C\u200D_\p{ID_Continue}]/u.test(char);
}

/**
 * Dependency-free lexical scan used by Afyx-native fact recognizers.
 *
 * Offsets and columns use JavaScript string indexes (UTF-16 code units), which
 * preserves the graph's established browser/LSP-facing position contract.
 * Comments and strings are consumed as opaque regions so syntax-looking text
 * inside them cannot become declarations or references.
 */
export function scanSource(source: string): NativeScanResult {
  const tokens: NativeToken[] = [];
  const pairs = new Map<number, number>();
  const stack: Array<{ token: number; close: string }> = [];
  const unterminated: Array<'string' | 'comment' | 'delimiter'> = [];
  let offset = 0;
  let line = 1;
  let column = 0;

  const position = (): NativePosition => ({ offset, line, column });
  const advance = (): string => {
    const char = source[offset++] ?? '';
    if (char === '\n') {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
    return char;
  };
  const emit = (kind: NativeTokenKind, start: NativePosition): void => {
    tokens.push({ kind, text: source.slice(start.offset, offset), start, end: position() });
  };

  while (offset < source.length) {
    const char = source[offset]!;
    const next = source[offset + 1];

    if (/\s/u.test(char)) {
      advance();
      continue;
    }

    if (char === '/' && next === '/') {
      advance();
      advance();
      while (offset < source.length && source[offset] !== '\n') advance();
      continue;
    }

    if (char === '/' && next === '*') {
      advance();
      advance();
      let closed = false;
      while (offset < source.length) {
        if (source[offset] === '*' && source[offset + 1] === '/') {
          advance();
          advance();
          closed = true;
          break;
        }
        advance();
      }
      if (!closed) unterminated.push('comment');
      continue;
    }

    if (char === '#') {
      while (offset < source.length && source[offset] !== '\n') advance();
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      const start = position();
      const quote = advance();
      let closed = false;
      while (offset < source.length) {
        const current = advance();
        if (current === '\\' && offset < source.length) {
          advance();
          continue;
        }
        if (current === quote) {
          closed = true;
          break;
        }
      }
      emit('string', start);
      if (!closed) unterminated.push('string');
      continue;
    }

    if (isIdentifierStart(char)) {
      const start = position();
      advance();
      while (offset < source.length && isIdentifierContinue(source[offset]!)) advance();
      emit('identifier', start);
      continue;
    }

    if (/\d/u.test(char)) {
      const start = position();
      advance();
      while (offset < source.length && /[\p{ID_Continue}.]/u.test(source[offset]!)) advance();
      emit('number', start);
      continue;
    }

    const start = position();
    advance();
    emit('punctuation', start);
    const tokenIndex = tokens.length - 1;
    if (char in OPEN_TO_CLOSE) {
      stack.push({ token: tokenIndex, close: OPEN_TO_CLOSE[char]! });
    } else if (CLOSE.has(char)) {
      const opener = stack.at(-1);
      if (opener?.close === char) {
        stack.pop();
        pairs.set(opener.token, tokenIndex);
        pairs.set(tokenIndex, opener.token);
      }
    }
  }

  if (stack.length > 0) unterminated.push('delimiter');
  return { tokens, pairs, unterminated };
}
