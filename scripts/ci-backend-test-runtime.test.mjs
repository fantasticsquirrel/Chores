import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const source = fileURLToPath(new URL('../backend/tests/test_family_tree_lifecycle_review.py', import.meta.url));

test('process-death probes select the current Python interpreter and preserve an explicit override', () => {
  // Execute only the trusted repository's actual runner assignment, not its
  // application fixtures. No database/storage writes or recovery assertions are substituted.
  const probe = `import ast,json,os,sys
from pathlib import Path
module=ast.parse(Path(sys.argv[1]).read_text())
function=next(n for n in module.body if isinstance(n,ast.FunctionDef) and n.name=='test_actual_process_death_recovers_claim_and_unpublished_object')
assignment=next(n for n in function.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='runner' for t in n.targets))
expression=compile(ast.Expression(assignment.value),str(sys.argv[1]),'eval')
os.environ.pop('FAMILY_TREE_TEST_PYTHON',None)
fallback=eval(expression,{'os':os,'sys':sys})
os.environ['FAMILY_TREE_TEST_PYTHON']='explicit-runner-sentinel'
override=eval(expression,{'os':os,'sys':sys})
print(json.dumps({'fallback_is_current':fallback==sys.executable,'override':override}))
`;
  const result = JSON.parse(execFileSync('python3', ['-c', probe, source], { encoding: 'utf8' }));
  assert.equal(result.fallback_is_current, true);
  assert.equal(result.override, 'explicit-runner-sentinel');
});
