/**
 * Afyx-owned branch-condition policy.
 *
 * A source location is resolved to its innermost AST node, then one bounded
 * ancestor walk asks a language profile two questions at every level:
 *
 * - which arm of the enclosing decision contains the location;
 * - which earlier sibling decisions terminate their taken arm.
 *
 * Profiles describe grammar vocabulary. The walk, ordering, branch identity,
 * cycle-free parent progression, and exit metadata are owned once here.
 */

import type { Node as SyntaxNode } from 'web-tree-sitter';
import type { Language } from '../types';

export type GuardForm = 'if' | 'else' | 'ternary' | 'case' | 'guard' | 'and' | 'or' | 'catch';
export type GuardExit = 'return' | 'throw' | 'exit';

export interface BranchGuard {
  text: string;
  negated: boolean;
  form: GuardForm;
  line: number;
  branch: string;
  armExit?: GuardExit;
  exit?: GuardExit;
}

export const BRANCH_GUARD_LANGUAGES: readonly Language[] = [
  'typescript', 'tsx', 'javascript', 'jsx', 'arkts', 'swift', 'python', 'java',
  'kotlin', 'csharp', 'go', 'c', 'cpp', 'objc',
];

const TEXT_LIMIT = 80;

type GuardDraft = Omit<BranchGuard, 'branch'> & { branch?: string };

interface GuardProfile {
  readonly boundaries: ReadonlySet<string>;
  readonly inlineFunctions: ReadonlySet<string>;
  readonly inlineBindings: ReadonlySet<string>;
  readonly statementLists: ReadonlySet<string>;
  inspect(parent: SyntaxNode, child: SyntaxNode): GuardDraft[];
  priorExits(parent: SyntaxNode, child: SyntaxNode): GuardDraft[];
}

interface CStyleShape {
  ifNode?: string;
  ternaryNode?: string;
  binaryNodes?: ReadonlySet<string>;
  catchNodes?: ReadonlySet<string>;
  thenField?: string;
  elseField?: string;
  trueField?: string;
  falseField?: string;
  conditionField?: string;
  leftField?: string;
  rightField?: string;
  operatorField?: string;
  catchBodyField?: string;
  inspectSpecial?(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] | null;
}

interface EarlyExitShape {
  ifNode: string;
  hasAlternative(node: SyntaxNode): boolean;
  body(node: SyntaxNode): SyntaxNode | null;
  condition(node: SyntaxNode): { node: SyntaxNode | null; text: string };
  alwaysLeaves(node: SyntaxNode | null): boolean;
}

const set = (...values: string[]): ReadonlySet<string> => new Set(values);
const field = (node: SyntaxNode | null | undefined, name: string): SyntaxNode | null => node?.childForFieldName(name) ?? null;
const same = (left: SyntaxNode | null | undefined, right: SyntaxNode | null | undefined): boolean => !!left && !!right && left.id === right.id;

function children(node: SyntaxNode | null | undefined): SyntaxNode[] {
  if (!node) return [];
  const result: SyntaxNode[] = [];
  for (let index = 0; index < node.namedChildCount; index++) result.push(node.namedChild(index)!);
  return result;
}

function siblingsBefore(parent: SyntaxNode, child: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  for (let index = 0; index < parent.namedChildCount; index++) {
    const sibling = parent.namedChild(index)!;
    if (sibling.id === child.id) break;
    result.push(sibling);
  }
  return result;
}

function lastChild(node: SyntaxNode | null | undefined): SyntaxNode | null {
  return node && node.namedChildCount > 0 ? node.namedChild(node.namedChildCount - 1) : null;
}

function collapseCondition(node: SyntaxNode | null | undefined): string {
  if (!node) return '';
  let current = node;
  while (current.type === 'parenthesized_expression' && current.namedChildCount === 1) current = current.namedChild(0)!;
  const value = current.text.replace(/\s+/g, ' ').trim();
  if (/^(?:let|var|case|try|await|guard|if|else|some|any)$/.test(value)) return '';
  return value.length > TEXT_LIMIT ? `${value.slice(0, TEXT_LIMIT - 1)}…` : value;
}

function fork(node: SyntaxNode | null | undefined): string {
  return node ? `${node.startPosition.row + 1}:${node.startPosition.column}` : '';
}

function draft(
  form: GuardForm,
  condition: SyntaxNode | null | undefined,
  negated: boolean,
  options: { text?: string; branch?: SyntaxNode | null; exit?: GuardExit | null } = {}
): GuardDraft | null {
  const text = options.text ?? collapseCondition(condition);
  if (!text) return null;
  return {
    text,
    negated,
    form,
    line: condition ? condition.startPosition.row + 1 : 0,
    ...(options.branch ? { branch: fork(options.branch) } : {}),
    ...(options.exit ? { exit: options.exit } : {}),
  };
}

function compact(...items: Array<GuardDraft | null>): GuardDraft[] {
  return items.filter((item): item is GuardDraft => item !== null);
}

const EXIT_CONTAINERS = set(
  'statement_block', 'block', 'statements', 'function_body', 'compound_statement',
  'control_structure_body', 'else_clause', 'else_statement', 'catch_clause',
  'catch_block', 'except_clause', 'finally_clause'
);

function exitKind(node: SyntaxNode | null | undefined): GuardExit | null {
  if (!node) return null;
  if (node.type === 'throw_statement' || node.type === 'raise_statement' || node.type === 'throw_expression') return 'throw';
  if (/^(?:return|break|continue|goto|yield)_statement$/.test(node.type)) return 'return';
  if (node.type === 'control_transfer_statement' || node.type === 'jump_expression') {
    return /^\s*throw\b/.test(node.text) ? 'throw' : 'return';
  }
  return EXIT_CONTAINERS.has(node.type) ? exitKind(lastChild(node)) : null;
}

function priorExitGuards(parent: SyntaxNode, child: SyntaxNode, shape: EarlyExitShape): GuardDraft[] {
  const result: GuardDraft[] = [];
  const preceding = siblingsBefore(parent, child);
  for (let index = preceding.length - 1; index >= 0; index--) {
    const candidate = preceding[index]!;
    if (candidate.type !== shape.ifNode || shape.hasAlternative(candidate)) continue;
    const body = shape.body(candidate);
    if (!shape.alwaysLeaves(body)) continue;
    const condition = shape.condition(candidate);
    const found = draft('guard', condition.node, true, {
      text: condition.text,
      branch: candidate,
      exit: exitKind(body) ?? 'exit',
    });
    if (found) result.push(found);
  }
  return result;
}

function cStyleInspector(shape: CStyleShape): (parent: SyntaxNode, child: SyntaxNode) => GuardDraft[] {
  return (parent, child) => {
    const special = shape.inspectSpecial?.(parent, child);
    if (special !== null && special !== undefined) return special;

    if (shape.ifNode && parent.type === shape.ifNode) {
      const condition = field(parent, shape.conditionField ?? 'condition');
      if (same(field(parent, shape.thenField ?? 'consequence'), child)) return compact(draft('if', condition, false));
      if (same(field(parent, shape.elseField ?? 'alternative'), child)) return compact(draft('else', condition, true));
      return [];
    }
    if (shape.ternaryNode && parent.type === shape.ternaryNode) {
      const condition = field(parent, shape.conditionField ?? 'condition');
      if (same(field(parent, shape.trueField ?? 'consequence'), child)) return compact(draft('ternary', condition, false));
      if (same(field(parent, shape.falseField ?? 'alternative'), child)) return compact(draft('ternary', condition, true));
      return [];
    }
    if (shape.binaryNodes?.has(parent.type) && same(field(parent, shape.rightField ?? 'right'), child)) {
      const operator = field(parent, shape.operatorField ?? 'operator')?.text;
      const left = field(parent, shape.leftField ?? 'left');
      if (operator === '&&') return compact(draft('and', left, false));
      if (operator === '||') return compact(draft('or', left, true));
    }
    if (shape.catchNodes?.has(parent.type)) {
      const body = shape.catchBodyField ? field(parent, shape.catchBodyField) : null;
      if (!body || same(body, child)) return compact(draft('catch', null, false, { text: 'on error' }));
    }
    return [];
  };
}

function simpleLeaves(exitTypes: ReadonlySet<string>, blockTypes: ReadonlySet<string>, terminalCalls: ReadonlySet<string> = new Set()) {
  const leaves = (node: SyntaxNode | null): boolean => {
    if (!node) return false;
    if (exitTypes.has(node.type)) return true;
    if (blockTypes.has(node.type)) return leaves(lastChild(node));
    if (node.type === 'expression_statement' && terminalCalls.size > 0) {
      const expression = node.namedChild(0);
      const callee = expression?.type === 'call_expression' ? field(expression, 'function')?.text : '';
      return !!callee && terminalCalls.has(callee);
    }
    return false;
  };
  return leaves;
}

const jsLeaves = simpleLeaves(set('return_statement', 'throw_statement', 'break_statement', 'continue_statement'), set('statement_block'));
const javaLeaves = simpleLeaves(set('return_statement', 'throw_statement', 'break_statement', 'continue_statement', 'yield_statement'), set('block'));
const csharpLeaves = simpleLeaves(set('return_statement', 'throw_statement', 'break_statement', 'continue_statement'), set('block'));
const goLeaves = simpleLeaves(set('return_statement', 'break_statement', 'continue_statement', 'goto_statement'), set('block'), set('panic', 'os.Exit', 'log.Fatal', 'log.Fatalf', 'log.Fatalln'));
const cLeaves = simpleLeaves(set('return_statement', 'break_statement', 'continue_statement', 'goto_statement', 'throw_statement'), set('compound_statement'), set('exit', '_exit', 'abort', 'longjmp'));
const pythonLeaves = simpleLeaves(set('return_statement', 'raise_statement', 'break_statement', 'continue_statement'), set('block'));
const kotlinLeaves = simpleLeaves(set('jump_expression'), set('control_structure_body', 'statements'));
const swiftLeaves = simpleLeaves(set('control_transfer_statement'), set('statements'));

const fixedCondition = (node: SyntaxNode): { node: SyntaxNode | null; text: string } => {
  const condition = field(node, 'condition');
  return { node: condition, text: collapseCondition(condition) };
};

function jsSpecial(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] | null {
  if (parent.type === 'switch_case' || parent.type === 'switch_default') {
    if (parent.type === 'switch_case' && same(field(parent, 'value'), child)) return [];
    const statement = parent.parent?.parent;
    const subject = collapseCondition(field(statement, 'value'));
    if (parent.type === 'switch_default') {
      return compact(draft('case', field(statement, 'value'), false, { text: subject ? `${subject}: default` : 'default', branch: statement }));
    }
    const valueNode = field(parent, 'value');
    const value = collapseCondition(valueNode);
    return compact(draft('case', valueNode, false, { text: subject ? `${subject} === ${value}` : value, branch: statement }));
  }
  return null;
}

const javascript: GuardProfile = {
  boundaries: set('function_declaration', 'method_definition', 'generator_function_declaration', 'class_declaration', 'class_body', 'class', 'program'),
  inlineFunctions: set('arrow_function', 'function_expression', 'function', 'generator_function'),
  inlineBindings: set('variable_declarator', 'assignment_expression', 'export_statement', 'public_field_definition', 'field_definition', 'lexical_declaration'),
  statementLists: set('statement_block', 'program', 'switch_case', 'switch_default'),
  inspect: cStyleInspector({
    ifNode: 'if_statement', ternaryNode: 'ternary_expression', binaryNodes: set('binary_expression'),
    catchNodes: set('catch_clause'), inspectSpecial: jsSpecial,
  }),
  priorExits: (parent, child) => priorExitGuards(parent, child, {
    ifNode: 'if_statement',
    hasAlternative: (node) => !!field(node, 'alternative'),
    body: (node) => field(node, 'consequence'),
    condition: fixedCondition,
    alwaysLeaves: jsLeaves,
  }),
};

function swiftCondition(node: SyntaxNode): { node: SyntaxNode | null; text: string } {
  const parts: SyntaxNode[] = [];
  for (let index = 0; index < node.childCount; index++) {
    if (node.fieldNameForChild(index) === 'condition') parts.push(node.child(index)!);
  }
  if (parts.length === 0) return { node: null, text: '' };
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const raw = node.text.slice(first.startIndex - node.startIndex, last.endIndex - node.startIndex).replace(/\s+/g, ' ').trim();
  if (/^(?:let|var|case|try|await)$/.test(raw)) return { node: null, text: '' };
  return { node: first, text: raw.length > TEXT_LIMIT ? `${raw.slice(0, TEXT_LIMIT - 1)}…` : raw };
}

function swiftElseArm(parent: SyntaxNode, child: SyntaxNode): boolean {
  let afterElse = false;
  for (let index = 0; index < parent.childCount; index++) {
    const current = parent.child(index)!;
    if (current.id === child.id) return afterElse;
    if (current.type === 'else') afterElse = true;
  }
  return false;
}

function swiftInspect(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] {
  if (parent.type === 'if_statement') {
    const condition = swiftCondition(parent);
    const childIndex = Array.from({ length: parent.childCount }, (_, index) => index)
      .find((index) => parent.child(index)?.id === child.id) ?? -1;
    if (parent.fieldNameForChild(childIndex) === 'condition') return [];
    const negated = swiftElseArm(parent, child);
    return compact(draft(negated ? 'else' : 'if', condition.node, negated, { text: condition.text }));
  }
  if (parent.type === 'guard_statement') {
    const condition = swiftCondition(parent);
    return compact(draft('else', condition.node, true, { text: condition.text }));
  }
  if (parent.type === 'ternary_expression') {
    const condition = field(parent, 'condition');
    if (same(field(parent, 'if_true'), child)) return compact(draft('ternary', condition, false));
    if (same(field(parent, 'if_false'), child)) return compact(draft('ternary', condition, true));
  }
  if (parent.type === 'switch_entry') {
    const statement = parent.parent;
    const subject = collapseCondition(field(statement, 'expr'));
    const pattern = children(parent).find((node) => node.type === 'switch_pattern');
    if (same(pattern, child)) return [];
    const isDefault = parent.children.some((node) => node.type === 'default_keyword');
    const value = collapseCondition(pattern);
    const text = isDefault ? (subject ? `${subject}: default` : 'default') : subject ? `${subject} == ${value}` : value;
    return compact(draft('case', pattern ?? field(statement, 'expr'), false, { text, branch: statement }));
  }
  if (parent.type === 'catch_block') return compact(draft('catch', null, false, { text: 'on error' }));
  return [];
}

function swiftPrior(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] {
  const result: GuardDraft[] = [];
  const preceding = siblingsBefore(parent, child);
  for (let index = preceding.length - 1; index >= 0; index--) {
    const statement = preceding[index]!;
    if (statement.type === 'guard_statement') {
      const condition = swiftCondition(statement);
      const body = children(statement).find((node) => node.type === 'statements') ?? null;
      const found = draft('guard', condition.node, false, { text: condition.text, branch: statement, exit: exitKind(body) ?? 'exit' });
      if (found) result.push(found);
    } else if (statement.type === 'if_statement' && !statement.children.some((node) => node.type === 'else')) {
      const body = children(statement).find((node) => node.type === 'statements') ?? null;
      if (!swiftLeaves(body)) continue;
      const condition = swiftCondition(statement);
      const found = draft('guard', condition.node, true, { text: condition.text, branch: statement, exit: exitKind(body) ?? 'exit' });
      if (found) result.push(found);
    }
  }
  return result;
}

const swift: GuardProfile = {
  boundaries: set('function_declaration', 'init_declaration', 'deinit_declaration', 'class_declaration', 'protocol_declaration', 'computed_property', 'source_file'),
  inlineFunctions: set('lambda_literal'),
  inlineBindings: set('property_declaration', 'assignment'),
  statementLists: set('statements', 'function_body'),
  inspect: swiftInspect,
  priorExits: swiftPrior,
};

function pythonOperator(node: SyntaxNode): string {
  const operator = field(node, 'operator');
  if (operator) return operator.text;
  for (let index = 0; index < node.childCount; index++) {
    const child = node.child(index)!;
    if (!child.isNamed && (child.text === 'and' || child.text === 'or')) return child.text;
  }
  return '';
}

function pythonInspect(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] {
  if (parent.type === 'if_statement') {
    const result: GuardDraft[] = [];
    const condition = field(parent, 'condition');
    if (same(field(parent, 'consequence'), child)) return compact(draft('if', condition, false));
    if (child.type === 'elif_clause' || child.type === 'else_clause') {
      const first = draft('else', condition, true);
      if (first) result.push(first);
      for (const sibling of siblingsBefore(parent, child)) {
        if (sibling.type === 'elif_clause') {
          const prior = draft('else', field(sibling, 'condition'), true);
          if (prior) result.push(prior);
        }
      }
    }
    return result;
  }
  if (parent.type === 'elif_clause' && same(field(parent, 'consequence'), child)) {
    return compact(draft('if', field(parent, 'condition'), false));
  }
  if (parent.type === 'conditional_expression') {
    const parts = children(parent);
    if (parts.length >= 3 && child.id === parts[0]!.id) return compact(draft('ternary', parts[1], false));
    if (parts.length >= 3 && child.id === parts[2]!.id) return compact(draft('ternary', parts[1], true));
  }
  if (parent.type === 'case_clause' && same(field(parent, 'consequence'), child)) {
    const statement = parent.parent?.parent;
    const subject = collapseCondition(field(statement, 'subject'));
    const pattern = children(parent).find((node) => node.type === 'case_pattern');
    const value = collapseCondition(pattern);
    const text = value === '_' || value === '' ? (subject ? `${subject}: default` : 'default') : subject ? `${subject} == ${value}` : value;
    return compact(draft('case', pattern, false, { text, branch: statement }));
  }
  if (parent.type === 'boolean_operator' && same(field(parent, 'right'), child)) {
    const operator = pythonOperator(parent);
    if (operator === 'and') return compact(draft('and', field(parent, 'left'), false));
    if (operator === 'or') return compact(draft('or', field(parent, 'left'), true));
  }
  if ((parent.type === 'except_clause' || parent.type === 'except_group_clause') && child.type === 'block') {
    return compact(draft('catch', null, false, { text: 'on error' }));
  }
  return [];
}

const python: GuardProfile = {
  boundaries: set('function_definition', 'class_definition', 'module'),
  inlineFunctions: set('lambda'),
  inlineBindings: set('assignment', 'augmented_assignment'),
  statementLists: set('block', 'module'),
  inspect: pythonInspect,
  priorExits: (parent, child) => priorExitGuards(parent, child, {
    ifNode: 'if_statement',
    hasAlternative: (node) => children(node).some((part) => part.type === 'elif_clause' || part.type === 'else_clause'),
    body: (node) => field(node, 'consequence'),
    condition: fixedCondition,
    alwaysLeaves: pythonLeaves,
  }),
};

function javaCaseText(labels: SyntaxNode[], subject: string): string {
  const values = labels
    .map((label) => children(label).map(collapseCondition).filter(Boolean).join(', '))
    .filter(Boolean);
  if (values.length === 0) return subject ? `${subject}: default` : 'default';
  const value = values.join(', ');
  return subject ? `${subject} == ${value}` : value;
}

function javaSpecial(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] | null {
  if (parent.type !== 'switch_block_statement_group' && parent.type !== 'switch_rule') return null;
  if (child.type === 'switch_label') return [];
  const statement = parent.parent?.parent;
  const subject = collapseCondition(field(statement, 'condition'));
  const labels = children(parent).filter((node) => node.type === 'switch_label');
  return compact(draft('case', labels[0], false, { text: javaCaseText(labels, subject), branch: statement }));
}

const java: GuardProfile = {
  boundaries: set('method_declaration', 'constructor_declaration', 'class_declaration', 'class_body', 'interface_declaration', 'enum_declaration', 'record_declaration', 'program'),
  inlineFunctions: set('lambda_expression'),
  inlineBindings: set('variable_declarator', 'assignment_expression', 'field_declaration'),
  statementLists: set('block', 'switch_block_statement_group', 'program', 'constructor_body'),
  inspect: cStyleInspector({ ifNode: 'if_statement', ternaryNode: 'ternary_expression', binaryNodes: set('binary_expression'), catchNodes: set('catch_clause'), catchBodyField: 'body', inspectSpecial: javaSpecial }),
  priorExits: (parent, child) => priorExitGuards(parent, child, {
    ifNode: 'if_statement', hasAlternative: (node) => !!field(node, 'alternative'),
    body: (node) => field(node, 'consequence'), condition: fixedCondition, alwaysLeaves: javaLeaves,
  }),
};

function kotlinArms(node: SyntaxNode): SyntaxNode[] {
  return children(node).filter((child) => child.type === 'control_structure_body');
}

function kotlinInspect(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] {
  if (parent.type === 'if_expression') {
    const parts = children(parent);
    const condition = parts[0] ?? null;
    if (same(condition, child)) return [];
    const arms = kotlinArms(parent);
    if (same(arms[0], child)) return compact(draft('if', condition, false));
    if (same(arms[1], child)) return compact(draft('else', condition, true));
  }
  if (parent.type === 'when_entry' && child.type === 'control_structure_body') {
    const statement = parent.parent;
    const subject = collapseCondition(children(statement).find((node) => node.type === 'when_subject')).replace(/^\((.*)\)$/, '$1');
    const conditions = children(parent).filter((node) => node.type === 'when_condition');
    if (conditions.length === 0) return compact(draft('case', null, false, { text: subject ? `${subject}: else` : 'else', branch: statement }));
    const value = conditions.map(collapseCondition).join(', ');
    return compact(draft('case', conditions[0], false, { text: subject ? `${subject} == ${value}` : value, branch: statement }));
  }
  if (parent.type === 'conjunction_expression' || parent.type === 'disjunction_expression') {
    const parts = children(parent);
    if (parts.length < 2 || !same(parts[parts.length - 1], child)) return [];
    return compact(draft(parent.type === 'conjunction_expression' ? 'and' : 'or', parts[0], parent.type === 'disjunction_expression'));
  }
  if (parent.type === 'catch_block' && child.type === 'statements') return compact(draft('catch', null, false, { text: 'on error' }));
  return [];
}

const kotlin: GuardProfile = {
  boundaries: set('function_declaration', 'secondary_constructor', 'class_declaration', 'class_body', 'object_declaration', 'getter', 'setter', 'source_file'),
  inlineFunctions: set('lambda_literal', 'anonymous_function'),
  inlineBindings: set('property_declaration', 'assignment'),
  statementLists: set('statements', 'function_body', 'source_file'),
  inspect: kotlinInspect,
  priorExits: (parent, child) => priorExitGuards(parent, child, {
    ifNode: 'if_expression', hasAlternative: (node) => kotlinArms(node).length > 1,
    body: (node) => kotlinArms(node)[0] ?? null,
    condition: (node) => {
      const condition = children(node)[0] ?? null;
      return { node: condition, text: collapseCondition(condition) };
    },
    alwaysLeaves: kotlinLeaves,
  }),
};

function csharpSpecial(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] | null {
  if (parent.type === 'switch_section') {
    const isLabel = (node: SyntaxNode) => /pattern$|switch_label$/.test(node.type);
    if (isLabel(child)) return [];
    const statement = parent.parent?.parent;
    const subject = collapseCondition(field(statement, 'value'));
    const labels = children(parent).filter(isLabel);
    const value = labels.map(collapseCondition).filter(Boolean).join(', ');
    const text = value === '' ? (subject ? `${subject}: default` : 'default') : subject ? `${subject} == ${value}` : value;
    return compact(draft('case', labels[0], false, { text, branch: statement }));
  }
  if (parent.type === 'switch_expression_arm' && same(field(parent, 'expression'), child)) {
    const statement = parent.parent;
    const subject = collapseCondition(field(statement, 'value'));
    const pattern = field(parent, 'pattern');
    const value = collapseCondition(pattern);
    const text = value === '_' || value === '' ? (subject ? `${subject}: default` : 'default') : subject ? `${subject} == ${value}` : value;
    return compact(draft('case', pattern, false, { text, branch: statement }));
  }
  return null;
}

const csharp: GuardProfile = {
  boundaries: set('method_declaration', 'constructor_declaration', 'local_function_statement', 'class_declaration', 'struct_declaration', 'record_declaration', 'interface_declaration', 'declaration_list', 'property_declaration', 'accessor_declaration', 'compilation_unit'),
  inlineFunctions: set('lambda_expression', 'anonymous_method_expression'),
  inlineBindings: set('variable_declarator', 'assignment_expression', 'equals_value_clause'),
  statementLists: set('block', 'switch_section', 'compilation_unit'),
  inspect: cStyleInspector({ ifNode: 'if_statement', ternaryNode: 'conditional_expression', binaryNodes: set('binary_expression'), catchNodes: set('catch_clause'), catchBodyField: 'body', inspectSpecial: csharpSpecial }),
  priorExits: (parent, child) => priorExitGuards(parent, child, {
    ifNode: 'if_statement', hasAlternative: (node) => !!field(node, 'alternative'),
    body: (node) => field(node, 'consequence'), condition: fixedCondition, alwaysLeaves: csharpLeaves,
  }),
};

function goSpecial(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] | null {
  if (parent.type === 'expression_case' || parent.type === 'type_case' || parent.type === 'communication_case') {
    const value = field(parent, 'value') ?? field(parent, 'type') ?? field(parent, 'communication');
    if (same(value, child)) return [];
    const statement = parent.parent;
    const subject = collapseCondition(field(statement, 'value'));
    const valueText = collapseCondition(value);
    const text = parent.type === 'communication_case' ? valueText : subject ? `${subject} == ${valueText}` : valueText;
    return compact(draft('case', value, false, { text, branch: statement }));
  }
  if (parent.type === 'default_case') {
    const statement = parent.parent;
    const subject = collapseCondition(field(statement, 'value'));
    return compact(draft('case', field(statement, 'value'), false, { text: subject ? `${subject}: default` : 'default', branch: statement }));
  }
  return null;
}

const go: GuardProfile = {
  boundaries: set('function_declaration', 'method_declaration', 'source_file'),
  inlineFunctions: set('func_literal'),
  inlineBindings: set('short_var_declaration', 'var_spec', 'assignment_statement', 'const_spec'),
  statementLists: set('block', 'expression_case', 'default_case', 'type_case', 'communication_case', 'source_file'),
  inspect: cStyleInspector({ ifNode: 'if_statement', binaryNodes: set('binary_expression'), inspectSpecial: goSpecial }),
  priorExits: (parent, child) => priorExitGuards(parent, child, {
    ifNode: 'if_statement', hasAlternative: (node) => !!field(node, 'alternative'),
    body: (node) => field(node, 'consequence'), condition: fixedCondition, alwaysLeaves: goLeaves,
  }),
};

function cSpecial(parent: SyntaxNode, child: SyntaxNode): GuardDraft[] | null {
  if (parent.type !== 'case_statement') return null;
  const value = field(parent, 'value');
  if (same(value, child)) return [];
  const statement = parent.parent?.parent;
  const subject = collapseCondition(field(statement, 'condition'));
  if (!value) return compact(draft('case', field(statement, 'condition'), false, { text: subject ? `${subject}: default` : 'default', branch: statement }));
  const valueText = collapseCondition(value);
  return compact(draft('case', value, false, { text: subject ? `${subject} == ${valueText}` : valueText, branch: statement }));
}

const cFamily: GuardProfile = {
  boundaries: set('function_definition', 'class_specifier', 'struct_specifier', 'namespace_definition', 'translation_unit', 'field_declaration_list'),
  inlineFunctions: set('lambda_expression'),
  inlineBindings: set('init_declarator', 'assignment_expression'),
  statementLists: set('compound_statement', 'case_statement', 'translation_unit'),
  inspect: cStyleInspector({ ifNode: 'if_statement', ternaryNode: 'conditional_expression', binaryNodes: set('binary_expression'), catchNodes: set('catch_clause'), catchBodyField: 'body', inspectSpecial: cSpecial }),
  priorExits: (parent, child) => priorExitGuards(parent, child, {
    ifNode: 'if_statement',
    hasAlternative: (node) => !!field(node, 'alternative') || children(node).some((part) => part.type === 'else_clause'),
    body: (node) => field(node, 'consequence'), condition: fixedCondition, alwaysLeaves: cLeaves,
  }),
};

const PROFILES: ReadonlyMap<Language, GuardProfile> = new Map([
  ['typescript', javascript], ['tsx', javascript], ['javascript', javascript], ['jsx', javascript], ['arkts', javascript],
  ['swift', swift], ['python', python], ['java', java], ['kotlin', kotlin], ['csharp', csharp],
  ['go', go], ['c', cFamily], ['cpp', cFamily], ['objc', cFamily],
]);

export function supportsBranchGuards(language: Language | string | undefined | null): boolean {
  return typeof language === 'string' && PROFILES.has(language as Language);
}

/** Shared ancestor-boundary view used by the separately frozen loop reader. */
export function branchWalkProfile(language: Language): Pick<GuardProfile, 'boundaries' | 'inlineFunctions' | 'inlineBindings'> | null {
  const profile = PROFILES.get(language);
  return profile
    ? { boundaries: profile.boundaries, inlineFunctions: profile.inlineFunctions, inlineBindings: profile.inlineBindings }
    : null;
}

export function branchForkKey(node: SyntaxNode): string {
  return fork(node);
}

export function branchNodeIsField(parent: SyntaxNode, name: string, child: SyntaxNode): boolean {
  return same(field(parent, name), child);
}

function locate(root: SyntaxNode, row: number, column: number): SyntaxNode | null {
  const initial = root.descendantForPosition({ row, column });
  if (!initial) return null;
  let current: SyntaxNode = initial;
  for (;;) {
    let child: SyntaxNode | null = null;
    for (let index = 0; index < current.namedChildCount; index++) {
      const candidate = current.namedChild(index)!;
      const start = candidate.startPosition;
      const end = candidate.endPosition;
      if ((start.row < row || (start.row === row && start.column <= column))
        && (end.row > row || (end.row === row && end.column > column))) {
        child = candidate;
        break;
      }
    }
    if (!child) return current;
    current = child;
  }
}

export function guardsInTree(
  root: SyntaxNode,
  source: string,
  language: Language,
  line: number,
  column: number | null
): BranchGuard[] {
  const profile = PROFILES.get(language);
  const row = line - 1;
  if (!profile || row < 0) return [];
  let resolvedColumn = column ?? 0;
  if (column === null) {
    const sourceLine = source.split('\n')[row] ?? '';
    const firstVisible = sourceLine.search(/\S/);
    resolvedColumn = firstVisible < 0 ? 0 : firstVisible;
  }
  const initial = locate(root, row, resolvedColumn);
  if (!initial) return [];
  let current: SyntaxNode = initial;

  const insideOut: GuardDraft[] = [];
  for (;;) {
    const parent: SyntaxNode | null = current.parent;
    if (!parent) break;
    if (profile.boundaries.has(parent.type)) break;
    if (profile.inlineFunctions.has(parent.type)) {
      if (profile.inlineBindings.has(parent.parent?.type ?? '')) break;
      current = parent;
      continue;
    }

    const enclosed = profile.inspect(parent, current);
    if (enclosed.length > 0) {
      const armExit = exitKind(current);
      for (const item of enclosed) {
        item.branch ??= fork(parent);
        if (armExit && !item.armExit) item.armExit = armExit;
        insideOut.push(item);
      }
    }
    if (profile.statementLists.has(parent.type)) insideOut.push(...profile.priorExits(parent, current));
    current = parent;
  }

  insideOut.reverse();
  return insideOut as BranchGuard[];
}

export function guardLabel(guards: readonly BranchGuard[]): string {
  return guards.map(labelPart).join(' && ');
}

function labelPart(guard: BranchGuard): string {
  if (guard.form === 'catch') return guard.text;
  if (!guard.negated) return topLevelDisjunction(guard.text) ? `(${guard.text})` : guard.text;
  if (/^!(?![=])/.test(guard.text) && simpleOperand(guard.text.slice(1))) return guard.text.slice(1);
  if (/^not\s+/.test(guard.text) && simpleOperand(guard.text.slice(4).trim())) return guard.text.slice(4).trim();
  const inverse = invertComparison(guard.text);
  if (inverse) return inverse;
  return simpleOperand(guard.text) ? `!${guard.text}` : `!(${guard.text})`;
}

function invertComparison(text: string): string | null {
  if (/&&|\|\||\band\b|\bor\b|\?/.test(text) || topLevelDisjunction(text)) return null;
  const match = /^([^=!<>]+?)\s*(===|!==|==|!=|\bis not\b|\bis\b)\s*([^=!<>]+)$/.exec(text);
  if (!match) return null;
  const opposite: Record<string, string> = { '===': '!==', '!==': '===', '==': '!=', '!=': '==', is: 'is not', 'is not': 'is' };
  const operator = opposite[match[2]!];
  return operator ? `${match[1]!.trim()} ${operator} ${match[3]!.trim()}` : null;
}

function topLevelDisjunction(text: string): boolean {
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (quote) {
      if (character === '\\') index++;
      else if (character === quote) quote = null;
    } else if (character === "'" || character === '"' || character === '`') quote = character;
    else if ('([{'.includes(character)) depth++;
    else if (')]}'.includes(character)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && character === '|' && text[index + 1] === '|') return true;
  }
  return false;
}

function simpleOperand(text: string): boolean {
  if (/[=<>]/.test(text) || /\s(?:&&|\|\||and|or)\s/.test(text)) return false;
  const match = /^([\w$.?!]+)(\(.*\))?$/s.exec(text);
  if (!match) return false;
  if (!match[2]) return true;
  let depth = 0;
  for (let index = 0; index < match[2].length; index++) {
    if (match[2][index] === '(') depth++;
    else if (match[2][index] === ')' && --depth === 0 && index < match[2].length - 1) return false;
  }
  return depth === 0;
}
