import * as fs from 'fs';
import * as path from 'path';

export type DagNode<T = any> = {
  name: string;
  deps?: string[];
  // optional cache key for incremental runs
  cacheKey?: string;
  // lifecycle hooks
  onStart?: (name: string) => void;
  onEnd?: (name: string, result: T) => void;
  onError?: (name: string, err: any) => void;
  run: (results: Record<string, any>) => Promise<T>;
};

// Simple DAG runner using Kahn's algorithm. Returns a map of nodeName -> result
export async function runDAG(nodes: DagNode[], options?: { cache?: boolean; cacheDir?: string; sendEvent?: (e: any) => void }) {
  const cacheEnabled = !!options?.cache;
  const cacheDir = options?.cacheDir || path.join(process.cwd(), '.out', 'pipeline-cache');
  if (cacheEnabled) {
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) {}
  }

  const nodeMap: Record<string, DagNode> = {};
  const indegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  for (const n of nodes) {
    nodeMap[n.name] = n;
    indegree[n.name] = 0;
    adj[n.name] = [];
  }

  for (const n of nodes) {
    const deps = n.deps || [];
    for (const d of deps) {
      if (!nodeMap[d]) throw new Error(`Missing dependency '${d}' for node '${n.name}'`);
      indegree[n.name] = (indegree[n.name] || 0) + 1;
      adj[d].push(n.name);
    }
  }

  const queue: string[] = Object.keys(indegree).filter(k => indegree[k] === 0);
  const results: Record<string, any> = {};

  while (queue.length > 0) {
    const name = queue.shift() as string;
    const node = nodeMap[name];
    // notify start
    try {
      options?.sendEvent?.({ type: 'NODE_START', node: name });
      node.onStart?.(name);

      // check cache
      if (cacheEnabled && node.cacheKey) {
        const cacheFile = path.join(cacheDir, encodeURIComponent(node.cacheKey) + '.json');
        if (fs.existsSync(cacheFile)) {
          const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          results[name] = cached;
          options?.sendEvent?.({ type: 'NODE_CACHE_HIT', node: name });
          node.onEnd?.(name, cached);
        } else {
          const res = await node.run(results);
          results[name] = res;
          try { fs.writeFileSync(path.join(cacheDir, encodeURIComponent(node.cacheKey) + '.json'), JSON.stringify(res)); } catch (e) {}
          node.onEnd?.(name, res);
          options?.sendEvent?.({ type: 'NODE_END', node: name });
        }
      } else {
        const res = await node.run(results);
        results[name] = res;
        node.onEnd?.(name, res);
        options?.sendEvent?.({ type: 'NODE_END', node: name });
      }
    } catch (err) {
      node.onError?.(name, err);
      options?.sendEvent?.({ type: 'NODE_ERROR', node: name, error: String(err) });
      throw err;
    }

    for (const neighbor of adj[name] || []) {
      indegree[neighbor]!--;
      if (indegree[neighbor] === 0) queue.push(neighbor);
    }
  }

  // Ensure all nodes ran
  const missing = Object.keys(nodeMap).filter(k => results[k] === undefined);
  if (missing.length) throw new Error(`DAG could not resolve nodes: ${missing.join(', ')}`);

  return results;
}
