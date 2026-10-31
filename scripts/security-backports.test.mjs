import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const modules = process.env.SECURITY_MODULES_ROOT || resolve('node_modules');
const braces = require(resolve(modules, 'braces'));
const deepmerge = require(resolve(modules, 'deepmerge'));
const nestingError = error => error.name === 'SyntaxError' && /nesting limit/.test(error.message);

for (const method of ['compile', 'expand', 'stringify', 'parse']) {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    test(`braces.${method} rejects deep ${open} without stack exhaustion`, () => {
      assert.throws(() => braces[method](open.repeat(4000) + 'a,b' + close.repeat(4000)), nestingError);
    });
  }
}
for (const method of ['compile', 'expand', 'stringify']) {
  test(`braces.${method} rejects a deep caller-supplied AST`, () => {
    let ast = { type: 'text', value: 'a' };
    for (let i = 0; i < 10000; i++) ast = { type: 'root', nodes: [ast] };
    assert.throws(() => braces[method](ast), nestingError);
  });
}
test('braces retains ordinary expansion and compilation', () => {
  assert.equal(braces.compile('x/{a,b}/{1..3}'), 'x/(a|b)/([1-3])');
  assert.deepEqual(braces.expand('x/{a,b}/{1..3}'), ['x/a/1','x/a/2','x/a/3','x/b/1','x/b/2','x/b/3']);
  assert.equal(braces.stringify(braces.parse('x/{a,b}')), 'x/{a,b}');
});
for (const [name, target, source, select] of [
  ['null-prototype target', Object.assign(Object.create(null), {debug:false}), JSON.parse('{"__proto__":{"isAdmin":true}}'), value => value],
  ['null placeholder', {session:null}, JSON.parse('{"session":{"__proto__":{"isAdmin":true}}}'), value => value.session],
  ['own target __proto__', JSON.parse('{"__proto__":{"isAdmin":true},"debug":false}'), {verbose:true}, value => value],
  ['nested array element', {list:[]}, JSON.parse('{"list":[{"__proto__":{"isAdmin":true}}]}'), value => value.list[0]],
]) {
  test(`deepmerge rejects ${name} prototype poisoning`, () => {
    const value = select(deepmerge(target, source));
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    assert.equal(value.isAdmin, undefined);
    assert.equal(Object.hasOwn(value, '__proto__'), false);
  });
}
test('deepmerge retains ordinary nested object and array behavior', () => {
  assert.deepEqual(deepmerge({nested:{left:1},list:[1]}, {nested:{right:2},list:[2]}), {
    nested:{left:1,right:2},list:[1,2],
  });
});
