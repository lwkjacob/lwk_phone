// Run: node src/calc.check.ts
import assert from 'node:assert/strict';
import { CALC0, calcKey } from './calc.ts';

const run = (keys: string) => [...keys].reduce(calcKey, CALC0).cur;

assert.equal(run('2+3='), '5');
assert.equal(run('2+3×4='), '20');
assert.equal(run('9÷4='), '2.25');
assert.equal(run('5−8='), '-3');
assert.equal(run('2+×3='), '6'); // second operator replaces the first
assert.equal(run('0.1+0.2='), '0.3'); // no float noise
assert.equal(run('50%'), '0.5');
assert.equal(run('7÷0='), 'Error');
assert.equal(run('12=3'), '3'); // typing after = starts over
console.log('calc ok');
