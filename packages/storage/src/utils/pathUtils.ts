/**
 * Cleans up the path input to ensure it confirms
 * to what textile buckets is expecting.
 *
 * @param path
 */
export const sanitizePath = (path: string): string => {
  // replace all windows path separator '\' with '/'
  const replacedSeparators = path.replace('\\', '/');
  // trim '/' at prefix
  const prefixTrimmed = replacedSeparators.replace(/^\/+/, '');
  // trim '\' or '/' at suffix
  const suffixTrimmed = prefixTrimmed.replace(/[/\\]+$/, '');

  return `/${suffixTrimmed}`;
};

export const isTopLevelPath = (path: string): boolean => sanitizePath(path).split('/').length === 2;

export const getParentPath = (path: string): string => {
  const segments = sanitizePath(path).split('/');
  return segments.slice(0, -1).join('/') || '/';
};

interface OrderGraph<T> {
  leafs: T[],
  child: {
    [name: string]: OrderGraph<T>;
  };
}

export interface OrderPathByParentsResult<T> {
  // Traverses each level of the graph
  // invokes the callback with each item of the level.
  // The promise resolves after all levels have been traversed
  traverseLevels: (cb: (levelLeafs: T[]) => Promise<void>) => Promise<void>;
}

// re-arrange file in order of parents path matching
// upload each of those file from based
// so given, a.txt, /a/b.txt, /a/c/d.txt, /a/e.txt, f.txt
// should be re-arranged to a.txt, f.txt, /a/b.txt, /a/e.txt, /a/c/d.txt
// @param paths - path items to be reordered and returned
// @param extractor - function to extract path string from path items.
export const reOrderPathByParents = <T>(paths: T[], extractor: (path: T) => string): OrderPathByParentsResult<T> => {
  // keep an object of paths segments and files
  const root: OrderGraph<T> = {
    leafs: [],
    child: {},
  };

  // first build graph
  // eslint-disable-next-line no-restricted-syntax
  for (const item of paths) {
    const path = sanitizePath(extractor(item));
    // empty because of the trailing slash '/' from sanitized paths
    let graph = root;
    const [_empty, ...segments] = path.split('/');
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (i === segments.length - 1) {
        // last segment put in files
        graph.leafs.push(item);
      } else {
        if (!graph.child[segment]) {
          graph.child[segment] = { leafs: [], child: { } };
        }
        graph = graph.child[segment];
      }
    }
  }

  return {
    traverseLevels: async (cb: (leafs: T[]) => Promise<void>): Promise<void> => {
      const queue = [root];
      while (queue.length !== 0) {
        const node = queue.shift();
        if (!node) {
          break;
        }
        if (node.leafs.length !== 0) {
          // eslint-disable-next-line no-await-in-loop
          await cb(node.leafs);
        }

        queue.push(...Object.values(node.child));
      }
    },
  };
};

export const filePathFromIpfsPath = (ipfsPath: string): string => {
  const paths = ipfsPath.split(/\/ip[f|n]s\/[^/]*/);
  return paths[1] || '';
};
