// Headless physics checks. Load the production TS with only rendering dependencies isolated.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
function load(path, names) {
  let source = readFileSync(new URL(path, root), 'utf8');
  if (names) {
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    source = ast.statements.filter((s) => names.includes(s.name?.text) || (ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => names.includes(d.name.text)))).map((s) => s.getText(ast)).join('\n');
  }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: (name) => name === 'three' ? THREE : name.includes('JourneyScene') ? load('src/components/journeys/JourneyScene.ts', ['rng']) : name === './units' ? load('src/components/history/battle/units.ts', ['COATS']) : require(name) });
  return exports;
}
const { BattleSim } = load('src/components/history/battle/sim.ts');
const script = { timeScale: 1, odds: [0, 0], setup: { test: { pos: [100, 100], face: 0 } }, cmds: { test: [{ at: 0, do: 'move', path: [[100, 900]], gait: 'gallop' }] } };
function make(slope) {
  const def = { id: 'test', name: 'test', side: 0, type: 'rider', n: 1, files: 1, gap: [2, 4], colA: ['#888888'], colB: ['#ffffff'] };
  const sim = new BattleSim({ W: 1000, D: 1000, y: (_x, z) => z * slope }, [def], new Map([['rider', { mounted: true, role: 'lancer' }]]), {}, {});
  sim.reset(script, 1);
  return sim;
}
function advance(sim) { for (let i = 0; i < 600; i++) sim.step(1 / 60, i / 600); }
const flat = make(0), uphill = make(0.5), downhill = make(-0.5);
advance(flat); advance(uphill); advance(downhill);
assert.ok(flat.z[0] > uphill.z[0] + 10, 'Uphill movement must be slower than flat ground');
assert.ok(flat.z[0] > downhill.z[0] + 10, 'Steep descents must also slow movement');
const before = uphill.z[0]; uphill.step(0, 0.8);
assert.equal(uphill.z[0], before, 'Pausing must freeze simulation');
flat.dust.push(1, 2, 3); flat.shots.push({ from: 0, to: 0 }); flat.reset(script, 1);
assert.equal(flat.time, 0); assert.equal(flat.dust.length, 0); assert.equal(flat.shots.length, 0);
advance(flat);
const repeat = make(0); advance(repeat);
assert.equal(flat.z[0], repeat.z[0], 'Restart must reproduce the trajectory');
console.log('PASS: uphill, downhill, pause, reset cleanup, repeatable movement');
