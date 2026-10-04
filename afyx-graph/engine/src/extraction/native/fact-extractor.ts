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
  readonly signature?: string;
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

  if (['typescript', 'tsx', 'javascript', 'jsx'].includes(language)) {
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
    const nameIndex = token.text === 'function' && tokens[i + 1]?.text === '*' ? i + 2 : i + 1;
    const name = tokens[nameIndex];
    if (!name || name.kind !== 'identifier') continue;
    if (token.text === 'class') addBlockDeclaration('class', i, i + 1);
    else if (token.text === 'interface') addBlockDeclaration('interface', i, i + 1);
    else if (token.text === 'enum') addBlockDeclaration('enum', i, i + 1);
    else if (token.text === 'function') addBlockDeclaration('function', i, nameIndex);
  }

  const containers = declarations.filter((declaration) =>
    declaration.bodyStart !== undefined && ['class', 'interface', 'struct', 'trait', 'type_alias', 'constant', 'variable'].includes(declaration.kind));

  for (const parent of containers) {
    const begin = parent.bodyStart! + 1;
    const end = parent.bodyEnd ?? tokens.length;
    for (let i = begin; i < end; i += 1) {
      const name = tokens[i]!;
      const openParen = tokens[i + 1];
      if (tokens[i - 1]?.text === '@') continue;
      if (['typescript', 'tsx', 'javascript', 'jsx'].includes(language) &&
          ['class', 'interface', 'type_alias'].includes(parent.kind) &&
          name.kind === 'identifier' && tokens[i + 1]?.text === ':') {
        const statementEnd = findNext(tokens, i + 2, ';', end);
        declarations.push({
          kind: 'property', name: name.text, start: i,
          end: statementEnd < 0 ? i + 1 : statementEnd, parent,
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
      if (name.kind !== 'identifier' || openParen?.text !== '(' || CALL_EXCLUSIONS.has(name.text)) continue;
      const prior = previousWord(tokens, i);
      if (prior === 'function' || prior === 'new') continue;
      const closeParen = scan.pairs.get(i + 1);
      if (closeParen === undefined) continue;
      const bodyStart = findNext(tokens, closeParen + 1, '{', end);
      if (bodyStart < 0) {
        if (parent.kind === 'interface' || parent.kind === 'type_alias') {
          const statementEnd = findNext(tokens, closeParen + 1, ';', end);
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

  for (let i = declarations.length - 1; i >= 0; i -= 1) {
    const declaration = declarations[i]!;
    if (declaration.kind !== 'constant' && declaration.kind !== 'variable') continue;
    const enclosingCallable = declarations.some((candidate) =>
      candidate !== declaration && (candidate.kind === 'function' || candidate.kind === 'method') &&
      candidate.bodyStart !== undefined && candidate.bodyStart < declaration.start && candidate.end >= declaration.end);
    if (enclosingCallable) declarations.splice(i, 1);
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
      signature: declaration.signature ?? (declaration.bodyStart === undefined
        ? undefined
        : source.slice(start.start.offset, tokens[declaration.bodyStart]!.start.offset).trim()),
      docstring: precedingDoc(tokens, declaration),
      updatedAt: Date.now(),
    };
    nodes.push(node);
    nodeByDeclaration.set(declaration, node);
    edges.push({ source: parentNode?.id ?? fileNode.id, target: node.id, kind: 'contains' });
  }

  if (['typescript', 'tsx'].includes(language)) {
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

  if (['typescript', 'tsx', 'javascript', 'jsx'].includes(language)) {
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

  if (['typescript', 'tsx', 'javascript', 'jsx'].includes(language)) {
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

  for (const declaration of declarations) {
    const callable = declaration.kind === 'function' || declaration.kind === 'method';
    const value = declaration.kind === 'constant' || declaration.kind === 'variable';
    if (!callable && !value) continue;
    const scanStart = declaration.bodyStart ?? (value ? declaration.start : undefined);
    const scanEnd = declaration.bodyEnd ?? (value ? declaration.end : undefined);
    if (scanStart === undefined || scanEnd === undefined) continue;
    const from = nodeByDeclaration.get(declaration);
    if (!from) continue;
    for (let i = scanStart + 1; i < scanEnd; i += 1) {
      const callee = tokens[i]!;
      if (callee.kind !== 'identifier' || tokens[i + 1]?.text !== '(' || CALL_EXCLUSIONS.has(callee.text)) continue;
      if (declarations.some((item) => item !== declaration && item.start === i)) continue;
      if (declarations.some((item) => item.parent === declaration && item.start <= i && item.end >= i)) continue;
      const receiver = tokens[i - 2]?.kind === 'identifier' && tokens[i - 1]?.text === '.' ? tokens[i - 2] : undefined;
      refs.push({
        fromNodeId: from.id,
        referenceName: receiver ? `${receiver.text}.${callee.text}` : callee.text,
        referenceKind: 'calls', line: callee.start.line,
        column: receiver?.start.column ?? callee.start.column,
      });
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
