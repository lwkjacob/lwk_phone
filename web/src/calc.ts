/* Calculator key reducer: pure, so it can be checked without rendering (calc.check.ts). */

export const OPS: Record<string, (a: number, b: number) => number> = { '÷': (a, b) => a / b, '×': (a, b) => a * b, '−': (a, b) => a - b, '+': (a, b) => a + b };

export type Calc = { cur: string; prev: number | null; op: string | null; fresh: boolean };
export const CALC0: Calc = { cur: '0', prev: null, op: null, fresh: true };

const show = (v: number) => (Number.isFinite(v) ? String(Number(v.toPrecision(10))) : 'Error');

export function calcKey(c: Calc, k: string): Calc {
  const val = Number(c.cur);
  if (/\d/.test(k)) return { ...c, cur: c.fresh || c.cur === '0' ? k : (c.cur + k).slice(0, 9), fresh: false };
  if (k === '.') return c.fresh ? { ...c, cur: '0.', fresh: false } : c.cur.includes('.') ? c : { ...c, cur: c.cur + '.' };
  if (k === 'AC') return CALC0;
  if (k === '±') return { ...c, cur: show(-val) };
  if (k === '%') return { ...c, cur: show(val / 100) };
  // Operators chain left to right, like a pocket calculator: 2 + 3 × 4 = 20.
  const done = c.op && c.prev != null && !c.fresh ? OPS[c.op](c.prev, val) : val;
  if (k === '=') return { cur: show(done), prev: null, op: null, fresh: true };
  return { cur: show(done), prev: done, op: k, fresh: true };
}
