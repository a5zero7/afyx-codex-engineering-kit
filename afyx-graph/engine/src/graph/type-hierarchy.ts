/**
 * Type hierarchy: the supertypes above a type, the subtypes below it, and how many
 * implementations a call through it can reach.
 *
 * The viewer's hierarchy block, `afyx_graph_explore`'s interface-dispatch boundary and
 * `afyx_graph_node`'s relation chips all need the same answer, so it is derived here
 * once and each surface only renders it.
 *
 * Everything is query-time and read-only, built from the `extends` / `implements` edges
 * the graph holds. The one derived fact — which members redeclare an ancestor's — is a
 * by-name match along a chain the graph already links, reported as a match rather than
 * as an edge (no extractor emits an `overrides` edge).
 *
 * Downward walks matter more than upward ones: ancestors are written in the file being
 * read, while implementations can live anywhere. Synthesized links (for example Go's
 * implicit interface satisfaction) carry their provenance so callers can draw them
 * differently.
 */

import type { Edge, EdgeKind, Node, NodeKind } from '../types';

/** The two edge kinds that make a type hierarchy. */
export const HIERARCHY_EDGE_KINDS: readonly EdgeKind[] = ['extends', 'implements'];

/**
 * Node kinds that can sit in a type hierarchy. `type_alias` is included because an
 * aliased type with subtypes is a real hierarchy however it was spelled, and `enum`
 * because Java, Kotlin and Swift enums implement interfaces.
 */
export const HIERARCHY_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>([
  'class', 'interface', 'struct', 'trait', 'protocol', 'enum', 'type_alias', 'union',
]);

/** Member kinds an override can be declared on. */
const OVERRIDABLE_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>(['method', 'function', 'property', 'field']);

/** Levels walked upward; a longer chain is a generated-code artefact. */
export const MAX_ANCESTOR_DEPTH = 8;

/** Levels walked downward. Depth only — the fan itself is capped separately. */
export const MAX_DESCENDANT_DEPTH = 6;

/**
 * Subtypes returned over the whole downward walk. When it bites, `bounded` says so, so a
 * fan that stopped early never reads as a complete answer.
 */
export const MAX_DESCENDANTS = 400;

/** Ancestors whose members are read when matching overrides. */
const MAX_OVERRIDE_ANCESTORS = 12;

/**
 * Implementations at or above which a call through the type cannot be resolved
 * statically — the threshold `afyx_graph_explore` uses to announce a dispatch boundary.
 */
export const DISPATCH_MIN_IMPLEMENTERS = 8;

/** How a subtype is tied to the type above it. */
export type HierarchyRelation = 'extends' | 'implements';

/** One type in the tree, and the single edge that puts it there. */
export interface HierarchyEntry {
  node: Node;
  /** Steps from the focus. 1 = declared directly on the focus (either way). */
  depth: number;
  /** The entry one step nearer the focus (the focus's own id at depth 1). */
  parentId: string;
  relation: HierarchyRelation;
  /** The edge, oriented subtype → supertype as the code declares it. */
  edge: Edge;
  /** The edge was synthesized rather than parsed. */
  synthesized: boolean;
  /** Direct subtypes this entry has that are not in the returned set. */
  hiddenSubtypes: number;
}

/** A member of the focus that redeclares a member of one of its ancestors. */
export interface OverrideMatch {
  /** The member on the focus. */
  memberId: string;
  /** The member it redeclares. */
  baseId: string;
  /** The ancestor type that declares `baseId`. */
  baseTypeId: string;
  baseTypeName: string;
  /** How the focus reaches that ancestor — `implements` reads as "satisfies". */
  relation: HierarchyRelation;
}

/** What is above a type, what is below it, and what a call through it reaches. */
export interface TypeHierarchy {
  focus: Node;
  /** Supertypes, nearest first, the focus's own parents leading. */
  ancestors: HierarchyEntry[];
  /** Subtypes, level by level, so depth 1 is complete before depth 2 begins. */
  descendants: HierarchyEntry[];
  /** True number of direct subtypes, whatever `descendants` was capped to. */
  directSubtypes: number;
  /** Of `directSubtypes`, the ones tied by `implements`. */
  directImplementers: number;
  /** The downward walk hit `MAX_DESCENDANTS` or `MAX_DESCENDANT_DEPTH`. */
  bounded: boolean;
  /** A call through this type dispatches at runtime (`directImplementers >= DISPATCH_MIN_IMPLEMENTERS`). */
  polymorphic: boolean;
  /** Members of the focus that redeclare an ancestor's, keyed by member id. */
  overrides: Map<string, OverrideMatch>;
}

/** The lookups the hierarchy walk needs; the engine facade provides all of them. */
export interface HierarchySource {
  getNodesByIds(ids: readonly string[]): Map<string, Node>;
  getOutgoingEdgesFrom(nodeIds: readonly string[], kinds?: EdgeKind[]): Edge[];
  getIncomingEdgesTo(nodeIds: readonly string[], kinds?: EdgeKind[]): Edge[];
}

/** Whether a node could have a hierarchy at all — a cheap gate before doing any work. */
export function canHaveHierarchy(node: Node): boolean {
  return HIERARCHY_KINDS.has(node.kind);
}

/**
 * The whole hierarchy of one type: one batched edge read per level in each direction
 * plus one batched member read, never a read per node.
 *
 * Returns `null` when the node cannot have a hierarchy or has no `extends`/`implements`
 * edge in either direction, so callers can gate on the result.
 */
export function buildTypeHierarchy(
  source: HierarchySource,
  focus: Node,
  options: { overrides?: boolean } = {}
): TypeHierarchy | null {
  if (!canHaveHierarchy(focus)) return null;

  const ancestors = climbSupertypes(source, focus);
  const fan = spreadSubtypes(source, focus);
  if (ancestors.length === 0 && fan.rows.length === 0) return null;

  return {
    focus,
    ancestors,
    descendants: fan.rows,
    directSubtypes: fan.directTotal,
    directImplementers: fan.directImplementers,
    bounded: fan.bounded,
    polymorphic: fan.directImplementers >= DISPATCH_MIN_IMPLEMENTERS,
    overrides: options.overrides === false ? new Map() : findOverrides(source, focus, ancestors),
  };
}

/** One batched read of hierarchy edges for a whole level; a failing read is an empty level. */
function levelEdges(source: HierarchySource, ids: readonly string[], direction: 'up' | 'down'): Edge[] {
  const kinds = [...HIERARCHY_EDGE_KINDS];
  try {
    const edges = direction === 'up' ? source.getOutgoingEdgesFrom(ids, kinds) : source.getIncomingEdgesTo(ids, kinds);
    // The kind filter runs in the store, but `relation` must never take a third value.
    return edges.filter((edge) => edge.kind === 'extends' || edge.kind === 'implements');
  } catch {
    return [];
  }
}

function rowFor(node: Node, depth: number, parentId: string, edge: Edge): HierarchyEntry {
  return {
    node,
    depth,
    parentId,
    relation: edge.kind === 'implements' ? 'implements' : 'extends',
    edge,
    synthesized: edge.provenance === 'heuristic',
    hiddenSubtypes: 0,
  };
}

/**
 * Order within one level: `extends` before `implements` (the one that carries the
 * implementation), then by name, file and line. Never by insertion order, so two runs
 * against one index draw the same tree.
 */
function orderLevel(level: HierarchyEntry[]): void {
  const rank = (row: HierarchyEntry): number => (row.relation === 'extends' ? 0 : 1);
  level.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.node.name.localeCompare(b.node.name) ||
      a.node.filePath.localeCompare(b.node.filePath) ||
      a.node.startLine - b.node.startLine
  );
}

/**
 * Supertypes level by level, nearest first. A class commonly has several direct parents
 * (one `extends`, some `implements`), so this is a breadth-first climb, not a chain.
 */
function climbSupertypes(source: HierarchySource, focus: Node): HierarchyEntry[] {
  const rows: HierarchyEntry[] = [];
  const met = new Set<string>([focus.id]);
  let frontier = [focus.id];

  for (let depth = 1; depth <= MAX_ANCESTOR_DEPTH && frontier.length > 0; depth++) {
    const edges = levelEdges(source, frontier, 'up');
    if (edges.length === 0) break;
    const parents = source.getNodesByIds(edges.map((edge) => edge.target));

    const level: HierarchyEntry[] = [];
    for (const edge of edges) {
      const parent = parents.get(edge.target);
      if (!parent || met.has(parent.id)) continue;
      met.add(parent.id);
      level.push(rowFor(parent, depth, edge.source, edge));
    }
    orderLevel(level);
    rows.push(...level);
    frontier = level.map((row) => row.node.id);
  }
  return rows;
}

interface Fan {
  rows: HierarchyEntry[];
  directTotal: number;
  directImplementers: number;
  bounded: boolean;
}

/**
 * Subtypes level by level, so the cap always trims the deepest, least relevant end.
 *
 * A subtype gets one row however many edges tie it to its supertype: a parsed `extends`
 * plus a synthesized `implements` is one implementation, and `extends` wins the
 * relation because it is the one written in the file. Once the cap is reached rows stop
 * being created, but direct subtypes keep being counted so `directTotal` stays true.
 */
function spreadSubtypes(source: HierarchySource, focus: Node): Fan {
  const rows: HierarchyEntry[] = [];
  const rowById = new Map<string, HierarchyEntry>();
  const met = new Set<string>([focus.id]);
  let frontier = [focus.id];
  let directTotal = 0;
  let directImplementers = 0;
  let bounded = false;

  for (let depth = 1; depth <= MAX_DESCENDANT_DEPTH && frontier.length > 0; depth++) {
    const edges = levelEdges(source, frontier, 'down');
    if (edges.length === 0) break;
    const children = source.getNodesByIds(edges.map((edge) => edge.source));

    const level: HierarchyEntry[] = [];
    const levelRows = new Map<string, HierarchyEntry>();
    const withheld = new Map<string, number>();
    for (const edge of edges) {
      const child = children.get(edge.source);
      if (!child || met.has(child.id)) continue;

      const row = levelRows.get(child.id);
      if (row) {
        if (row.relation === 'implements' && edge.kind === 'extends') {
          row.relation = 'extends';
          row.edge = edge;
          row.synthesized = edge.provenance === 'heuristic';
        }
        continue;
      }

      if (depth === 1) {
        directTotal++;
        if (edge.kind === 'implements') directImplementers++;
      }
      if (rows.length + level.length >= MAX_DESCENDANTS) {
        bounded = true;
        withheld.set(edge.target, (withheld.get(edge.target) ?? 0) + 1);
        continue;
      }
      const created = rowFor(child, depth, edge.target, edge);
      level.push(created);
      levelRows.set(child.id, created);
    }

    for (const row of level) met.add(row.node.id);
    orderLevel(level);
    for (const row of level) {
      rows.push(row);
      rowById.set(row.node.id, row);
    }
    for (const [parentId, count] of withheld) {
      const parent = rowById.get(parentId);
      if (parent) parent.hiddenSubtypes += count;
    }
    if (bounded) break;

    frontier = level.map((row) => row.node.id);
    if (depth === MAX_DESCENDANT_DEPTH && frontier.length > 0) {
      // Something sits below the last level walked: mark those rows so they do not read as leaves.
      for (const edge of levelEdges(source, frontier, 'down')) {
        if (met.has(edge.source)) continue;
        bounded = true;
        const parent = rowById.get(edge.target);
        if (parent) parent.hiddenSubtypes++;
      }
    }
  }
  return { rows, directTotal, directImplementers, bounded };
}

/**
 * Members of the focus that redeclare a member of an ancestor.
 *
 * It is a name match inside a chain the graph already established — which is what every
 * language's dispatch rule is — and is deliberately blind to signatures: claiming an
 * override for the wrong overload is worse than naming the type that also declares the
 * name. Two batched reads in total, whatever the ancestor count.
 */
function findOverrides(
  source: HierarchySource,
  focus: Node,
  ancestors: readonly HierarchyEntry[]
): Map<string, OverrideMatch> {
  const matches = new Map<string, OverrideMatch>();
  if (ancestors.length === 0) return matches;

  const own = memberRows(source, [focus.id]);
  if (own.length === 0) return matches;

  // Nearest ancestors win: a method redeclared two levels up is reported against the
  // type the reader would actually look in.
  const chain = ancestors.slice(0, MAX_OVERRIDE_ANCESTORS);
  const inherited = memberRows(source, chain.map((row) => row.node.id));
  if (inherited.length === 0) return matches;

  const chainRow = new Map(chain.map((row) => [row.node.id, row] as const));
  // Member rows follow the order of the ids given, so the first row per name is the nearest.
  const declaredBy = new Map<string, { member: Node; ownerId: string }>();
  for (const row of inherited) {
    if (!declaredBy.has(row.member.name)) declaredBy.set(row.member.name, row);
  }

  for (const { member } of own) {
    if (!OVERRIDABLE_KINDS.has(member.kind)) continue;
    const base = declaredBy.get(member.name);
    if (!base || base.member.id === member.id) continue;
    const owner = chainRow.get(base.ownerId);
    if (!owner) continue;
    matches.set(member.id, {
      memberId: member.id,
      baseId: base.member.id,
      baseTypeId: owner.node.id,
      baseTypeName: owner.node.name,
      relation: owner.relation,
    });
  }
  return matches;
}

/** Direct `contains` members of the given containers, grouped in the containers' order, then by line. */
function memberRows(
  source: HierarchySource,
  containerIds: readonly string[]
): Array<{ member: Node; ownerId: string }> {
  if (containerIds.length === 0) return [];
  let edges: Edge[];
  try {
    edges = source.getOutgoingEdgesFrom(containerIds, ['contains']);
  } catch {
    return [];
  }
  if (edges.length === 0) return [];
  const found = source.getNodesByIds(edges.map((edge) => edge.target));

  const position = new Map(containerIds.map((id, index) => [id, index] as const));
  const rows: Array<{ member: Node; ownerId: string }> = [];
  for (const edge of edges) {
    const member = found.get(edge.target);
    if (member) rows.push({ member, ownerId: edge.source });
  }
  return rows.sort(
    (a, b) =>
      (position.get(a.ownerId) ?? 0) - (position.get(b.ownerId) ?? 0) || a.member.startLine - b.member.startLine
  );
}

/**
 * How many distinct types extend or implement this one — the number
 * `afyx_graph_explore` prints for a dispatch boundary and the viewer's fan draws.
 * Distinct types, not edges: one class tied by both `extends` and a synthesized
 * `implements` is one implementation.
 */
export function countImplementers(source: HierarchySource, typeId: string): number {
  try {
    const edges = source.getIncomingEdgesTo([typeId], [...HIERARCHY_EDGE_KINDS]);
    return new Set(edges.map((edge) => edge.source)).size;
  } catch {
    return 0;
  }
}
