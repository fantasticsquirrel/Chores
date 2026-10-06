'use strict';

// Local GHSA-vfj7-8cjw-p6xm mitigation. Do not expose an option to lift this cap.
module.exports = ast => {
  const stack = [[ast, 0]];
  let visited = 0;
  while (stack.length) {
    const [node, depth] = stack.pop();
    if (depth > 128 || ++visited > 65536) {
      throw new SyntaxError('braces nesting limit exceeded');
    }
    if (node && Array.isArray(node.nodes)) {
      for (const child of node.nodes) stack.push([child, depth + 1]);
    }
  }
};
