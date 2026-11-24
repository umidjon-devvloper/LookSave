import { describe, expect, it } from 'vitest';

import { parseChoice } from './openai-text';

describe('parseChoice', () => {
  it('to`g`ri javobni qabul qiladi', () => {
    expect(parseChoice('{"answer":"Mana","picks":[3,1]}', 5)).toEqual({ answer: 'Mana', picks: [3, 1] });
  });

  it('chegaradan tashqari, takroriy va kasr raqamlar tashlanadi', () => {
    expect(parseChoice('{"answer":"x","picks":[0,6,2,2,1.5,"4"]}', 5)?.picks).toEqual([2, 4]);
  });

  it('bo`sh javob yoki buzuq JSON — null', () => {
    expect(parseChoice('{"answer":"","picks":[1]}', 5)).toBeNull();
    expect(parseChoice('```json {}```', 5)).toBeNull();
  });

  it('picks yo`q bo`lsa bo`sh massiv (mavzudan tashqari savol)', () => {
    expect(parseChoice('{"answer":"Salom"}', 5)).toEqual({ answer: 'Salom', picks: [] });
  });
});
