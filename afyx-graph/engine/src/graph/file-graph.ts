/**
 * The file-level view of the graph: directory layout and file dependency cycles.
 */

import type { GraphCatalog } from './graph-store';

/** Files grouped by containing directory; a file with no directory part lives in `.`. */
export function directoryLayout(catalog: GraphCatalog): Map<string, string[]> {
  const layout = new Map<string, string[]>();
  for (const { path } of catalog.getAllFiles()) {
    const directory = path.split('/').slice(0, -1).join('/') || '.';
    const members = layout.get(directory);
    if (members) members.push(path);
    else layout.set(directory, [path]);
  }
  return layout;
}

interface DependencyFrame {
  file: string;
  dependencies: string[];
  cursor: number;
}

/**
 * Cycles among file dependencies.
 *
 * A depth-first search over `getDependencyFilePaths`, starting from each file in
 * catalogue order. Whenever a dependency is already on the current search path, the
 * slice of the path from that file down to the file that depends on it is one cycle.
 * Files are explored once, so a cycle is reported from the first file that reaches it.
 */
export function dependencyCycles(catalog: GraphCatalog): string[][] {
  const cycles: string[][] = [];
  const explored = new Set<string>();
  const trail: string[] = [];
  const onTrail = new Set<string>();
  const stack: DependencyFrame[] = [];

  const enter = (file: string): void => {
    explored.add(file);
    trail.push(file);
    onTrail.add(file);
    stack.push({ file, dependencies: catalog.getDependencyFilePaths(file), cursor: 0 });
  };

  for (const { path: root } of catalog.getAllFiles()) {
    if (explored.has(root)) continue;
    enter(root);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      if (frame.cursor >= frame.dependencies.length) {
        onTrail.delete(frame.file);
        trail.pop();
        stack.pop();
        continue;
      }
      const dependency = frame.dependencies[frame.cursor++]!;
      if (onTrail.has(dependency)) {
        cycles.push(trail.slice(trail.indexOf(dependency)));
      } else if (!explored.has(dependency)) {
        enter(dependency);
      }
    }
  }
  return cycles;
}
