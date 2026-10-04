import * as path from 'path';
import type { Edge, ExtractionResult, Language, Node, NodeKind, UnresolvedReference } from '../../types';
import { generateNodeId } from '../node-id';
import { scanSource, type NativeToken } from './scanner';

const CALL_EXCLUSIONS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'with', 'function', 'typeof', 'delete',
  'return', 'throw', 'new', 'class', 'interface', 'enum', 'constructor',
]);

const MODIFIERS = new Set([
  'export', 'default', 'declare', 'async', 'public', 'private', 'protected',
  'internal', 'static', 'abstract', 'readonly', 'override', 'final',
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
  const started = Date.now();
  const scan = scanSource(source);
  const tokens = scan.tokens;
  const declarations: Declaration[] = [];
  const importedNames = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i]!.text !== 'import') continue;
    for (let j = i + 1; j < tokens.length && tokens[j]!.start.line === tokens[i]!.start.line; j += 1) {
      const token = tokens[j]!;
      if (token.kind === 'string') break;
      if (token.kind === 'identifier' && token.text !== 'from' && token.text !== 'as') importedNames.add(token.text);
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
  }

  if (language === 'go') {
    for (let i = 0; i < tokens.length - 2; i += 1) {
      if (tokens[i]!.text === 'type' && tokens[i + 1]!.kind === 'identifier') {
        const shape = tokens[i + 2]!.text;
        if (shape !== 'struct' && shape !== 'interface') continue;
        const open = findNext(tokens, i + 3, '{');
        const close = open < 0 ? undefined : scan.pairs.get(open);
        declarations.push({
          kind: shape, name: tokens[i + 1]!.text, start: i, end: close ?? i + 2,
          bodyStart: open < 0 ? undefined : open, bodyEnd: close,
          exported: /^[A-Z]/.test(tokens[i + 1]!.text),
        });
      }
      if (tokens[i]!.text !== 'func') continue;
      let nameIndex = i + 1;
      if (tokens[nameIndex]?.text === '(') {
        const receiverEnd = scan.pairs.get(nameIndex);
        if (receiverEnd === undefined) continue;
        nameIndex = receiverEnd + 1;
      }
      if (tokens[nameIndex]?.kind !== 'identifier') continue;
      const params = findNext(tokens, nameIndex + 1, '(');
      const paramsEnd = params < 0 ? undefined : scan.pairs.get(params);
      const open = paramsEnd === undefined ? -1 : findNext(tokens, paramsEnd + 1, '{');
      const close = open < 0 ? undefined : scan.pairs.get(open);
      declarations.push({
        kind: 'function', name: tokens[nameIndex]!.text, start: i, end: close ?? (paramsEnd ?? nameIndex),
        bodyStart: open < 0 ? undefined : open, bodyEnd: close,
        exported: /^[A-Z]/.test(tokens[nameIndex]!.text),
      });
    }
  }

  const addBlockDeclaration = (kind: NodeKind, keyword: number, nameIndex: number): Declaration | undefined => {
    const open = findNext(tokens, nameIndex + 1, '{');
    if (open < 0) return undefined;
    const close = scan.pairs.get(open);
    const modifierStart = declarationStart(tokens, keyword);
    const declaration: Declaration = {
      kind,
      name: tokens[nameIndex]!.text,
      start: keyword,
      end: close ?? open,
      bodyStart: open,
      bodyEnd: close,
      exported: tokens.slice(modifierStart, keyword).some((token) => token.text === 'export'),
      async: tokens.slice(modifierStart, keyword).some((token) => token.text === 'async'),
      static: tokens.slice(modifierStart, keyword).some((token) => token.text === 'static'),
      visibility: visibility(tokens, modifierStart, keyword),
    };
    declarations.push(declaration);
    return declaration;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    const name = tokens[i + 1];
    if (!name || name.kind !== 'identifier') continue;
    if (token.text === 'class') addBlockDeclaration('class', i, i + 1);
    else if (token.text === 'interface') addBlockDeclaration('interface', i, i + 1);
    else if (token.text === 'enum') addBlockDeclaration('enum', i, i + 1);
    else if (token.text === 'function') addBlockDeclaration('function', i, i + 1);
  }

  const containers = declarations.filter((declaration) =>
    declaration.bodyStart !== undefined && ['class', 'interface', 'struct', 'trait'].includes(declaration.kind));

  for (const parent of containers) {
    const begin = parent.bodyStart! + 1;
    const end = parent.bodyEnd ?? tokens.length;
    for (let i = begin; i < end; i += 1) {
      const name = tokens[i]!;
      const openParen = tokens[i + 1];
      if (name.kind !== 'identifier' || openParen?.text !== '(' || CALL_EXCLUSIONS.has(name.text)) continue;
      const prior = previousWord(tokens, i);
      if (prior === 'function' || prior === 'new') continue;
      const closeParen = scan.pairs.get(i + 1);
      if (closeParen === undefined) continue;
      const bodyStart = findNext(tokens, closeParen + 1, '{', end);
      if (bodyStart < 0) continue;
      const bodyEnd = scan.pairs.get(bodyStart);
      if (bodyEnd === undefined || bodyEnd > end) continue;
      const start = declarationStart(tokens, i);
      declarations.push({
        kind: 'method',
        name: name.text,
        start,
        end: bodyEnd,
        bodyStart,
        bodyEnd,
        parent,
        async: tokens.slice(start, i).some((item) => item.text === 'async'),
        static: tokens.slice(start, i).some((item) => item.text === 'static'),
        visibility: visibility(tokens, start, i),
      });
      i = bodyEnd;
    }
  }

  for (let i = 0; i < tokens.length - 3; i += 1) {
    if (!['const', 'let', 'var'].includes(tokens[i]!.text)) continue;
    const name = tokens[i + 1]!;
    if (name.kind !== 'identifier') continue;
    const arrow = findNext(tokens, i + 2, '=>', Math.min(tokens.length, i + 20));
    if (arrow < 0) continue;
    const bodyStart = tokens[arrow + 1]?.text === '{' ? arrow + 1 : undefined;
    const bodyEnd = bodyStart === undefined ? undefined : scan.pairs.get(bodyStart);
    declarations.push({
      kind: 'function', name: name.text, start: declarationStart(tokens, i),
      end: bodyEnd ?? arrow + 1, bodyStart, bodyEnd,
      exported: tokens.slice(Math.max(0, i - 3), i).some((item) => item.text === 'export'),
      async: tokens.slice(i + 2, arrow).some((item) => item.text === 'async'),
    });
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
      isExported: declaration.exported || undefined,
      isAsync: declaration.async || undefined,
      isStatic: declaration.static || undefined,
      visibility: declaration.visibility,
      signature: declaration.bodyStart === undefined
        ? undefined
        : source.slice(start.start.offset, tokens[declaration.bodyStart]!.start.offset).trim(),
      updatedAt: Date.now(),
    };
    nodes.push(node);
    nodeByDeclaration.set(declaration, node);
    edges.push({ source: parentNode?.id ?? fileNode.id, target: node.id, kind: 'contains' });
  }

  for (const declaration of declarations) {
    if (declaration.kind !== 'function' && declaration.kind !== 'method') continue;
    if (declaration.bodyStart === undefined || declaration.bodyEnd === undefined) continue;
    const from = nodeByDeclaration.get(declaration);
    if (!from) continue;
    for (let i = declaration.bodyStart + 1; i < declaration.bodyEnd; i += 1) {
      const callee = tokens[i]!;
      if (callee.kind !== 'identifier' || tokens[i + 1]?.text !== '(' || CALL_EXCLUSIONS.has(callee.text)) continue;
      if (declarations.some((item) => item !== declaration && item.start === i)) continue;
      const receiver = tokens[i - 2]?.kind === 'identifier' && tokens[i - 1]?.text === '.' ? tokens[i - 2] : undefined;
      refs.push({
        fromNodeId: from.id,
        referenceName: receiver ? `${receiver.text}.${callee.text}` : callee.text,
        referenceKind: 'calls', line: callee.start.line,
        column: receiver?.start.column ?? callee.start.column,
      });
    }
    if (language === 'go') {
      for (let i = declaration.start + 1; i < declaration.bodyStart; i += 1) {
        const typeToken = tokens[i]!;
        if (typeToken.kind !== 'identifier' || !/^[A-Z]/.test(typeToken.text) || typeToken.text === declaration.name) continue;
        refs.push({
          fromNodeId: from.id, referenceName: typeToken.text, referenceKind: 'references',
          line: typeToken.start.line, column: typeToken.start.column,
        });
      }
    }
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i]!.text !== 'import') continue;
    let moduleToken: NativeToken | undefined;
    for (let j = i + 1; j < tokens.length && tokens[j]!.start.line === tokens[i]!.start.line; j += 1) {
      if (tokens[j]!.kind === 'string') moduleToken = tokens[j];
    }
    if (!moduleToken) continue;
    const importName = moduleToken.text.slice(1, -1);
    const importStart = language === 'go' ? moduleToken.start : tokens[i]!.start;
    const importNode: Node = {
      id: generateNodeId(filePath, 'import', importName, tokens[i]!.start.line),
      kind: 'import', name: importName, qualifiedName: importName, filePath, language,
      startLine: importStart.line, endLine: moduleToken.end.line,
      startColumn: importStart.column, endColumn: language === 'go' ? moduleToken.end.column : moduleToken.end.column + 1,
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
      if (binding.kind !== 'identifier' || binding.text === 'from' || binding.text === 'as') continue;
      refs.push({
        fromNodeId: fileNode.id, referenceName: binding.text, referenceKind: 'imports',
        line: binding.start.line, column: binding.start.column,
      });
    }
  }

  if (language === 'python') {
    for (let i = 0; i < tokens.length; i += 1) {
      if (tokens[i]!.text !== 'from' || tokens[i + 1]?.kind !== 'identifier') continue;
      const moduleToken = tokens[i + 1]!;
      const importIndex = findNext(tokens, i + 2, 'import');
      if (importIndex < 0 || tokens[importIndex]!.start.line !== tokens[i]!.start.line) continue;
      const lineTokens = tokens.slice(importIndex + 1).filter((token) => token.start.line === tokens[i]!.start.line);
      const last = lineTokens.at(-1) ?? moduleToken;
      const importNode: Node = {
        id: generateNodeId(filePath, 'import', moduleToken.text, tokens[i]!.start.line),
        kind: 'import', name: moduleToken.text, qualifiedName: moduleToken.text,
        filePath, language, startLine: tokens[i]!.start.line, endLine: last.end.line,
        startColumn: tokens[i]!.start.column, endColumn: last.end.column, updatedAt: Date.now(),
      };
      nodes.push(importNode);
      edges.push({ source: fileNode.id, target: importNode.id, kind: 'contains' });
      refs.push({
        fromNodeId: fileNode.id, referenceName: moduleToken.text, referenceKind: 'imports',
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
