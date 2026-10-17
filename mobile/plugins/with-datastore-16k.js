const { withAppBuildGradle } = require('expo/config-plugins');

const dependency = '    implementation("androidx.datastore:datastore-core:1.2.1")';

function addDataStore(contents) {
  // Mask comments/quoted strings before checking the generated Groovy structure.
  // Preserve offsets and newlines so insertion never rewrites unrelated text.
  const structure = contents.replace(
    /\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    value => value.replace(/[^\r\n]/g, ' '),
  );
  const targets = [...structure.matchAll(/^dependencies\s*\{[^\S\r\n]*\r?\n/gm)];
  if (targets.length !== 1) {
    throw new Error('Expected exactly one generated app dependencies block.');
  }
  let depth = 0;
  let end = -1;
  const start = targets[0].index;
  for (let i = 0; i < structure.length; i += 1) {
    if (structure[i] === '{') depth += 1;
    if (structure[i] === '}') {
      depth -= 1;
      if (i > start && depth === 0 && end === -1) end = i;
      if (depth < 0) throw new Error('Expected balanced Gradle dependencies structure.');
    }
    if (i === start && depth !== 0) {
      throw new Error('Expected top-level app dependencies block.');
    }
  }
  if (depth !== 0 || end === -1) {
    throw new Error('Expected balanced Gradle dependencies structure.');
  }
  const insertion = start + targets[0][0].length;
  const block = contents.slice(insertion, end);
  const declarations = block.match(/androidx\.datastore:/g) || [];
  if (declarations.length) {
    const existing = block.indexOf(dependency);
    const active = existing >= 0 && structure.slice(insertion + existing).startsWith('    implementation(');
    if (declarations.length === 1 && active && block.split(/\r?\n/).includes(dependency)) {
      return contents;
    }
    throw new Error('Unexpected or conflicting DataStore declaration in app dependencies.');
  }
  const newline = contents.includes('\r\n') ? '\r\n' : '\n';
  return contents.slice(0, insertion) + dependency + newline + contents.slice(insertion);
}

module.exports = config => withAppBuildGradle(config, mod => {
  if (mod.modResults.language !== 'groovy') {
    throw new Error('DataStore correction requires a generated Groovy app/build.gradle.');
  }
  mod.modResults.contents = addDataStore(mod.modResults.contents);
  return mod;
});
