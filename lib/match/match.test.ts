import { describe, expect, it } from 'vitest';

import { normalize } from '@/lib/query/normalize';

import { isStrong, match } from './match';

const issues = { text: '課題一覧', aliases: ['issues', 'かだい'] };

describe('一致の強さ', () => {
  it('完全一致は前方一致より強く、前方一致は部分一致より強い', () => {
    expect(match(normalize('ボード'), { text: 'ボード' })?.strength).toBe('exact');
    expect(match(normalize('ぼー'), { text: 'ボード' })?.strength).toBe('prefix');
    expect(match(normalize('ーど'), { text: 'ボード' })?.strength).toBe('substring');
  });

  it('含まれない語は一致しない', () => {
    expect(match(normalize('がんと'), { text: 'ボード' })).toBeUndefined();
  });

  it('空の入力は何にも一致しない', () => {
    expect(match(normalize(''), { text: 'ボード' })).toBeUndefined();
  });

  it('前方一致以上を強いローカル一致とみなす', () => {
    expect(isStrong(match(normalize('ぼー'), { text: 'ボード' }))).toBe(true);
    expect(isStrong(match(normalize('ーど'), { text: 'ボード' }))).toBe(false);
    expect(isStrong()).toBe(false);
  });
});

describe('正規化を通した照合', () => {
  it('ひらがなで打った語はカタカナのタイトルに届く', () => {
    expect(match(normalize('ぼーど'), { text: 'ボード' })?.strength).toBe('exact');
  });

  it('全角の英字で打った語は半角のタイトルに届く', () => {
    expect(match(normalize('Ｗｉｋｉ'), { text: 'Wiki' })?.strength).toBe('exact');
  });
});

describe('別名と読み替え', () => {
  it('英字の別名に一致する', () => {
    expect(match(normalize('issues'), issues)).toEqual({ strength: 'exact', via: 'alias' });
  });

  it('ローマ字入力はかなの別名に届く', () => {
    expect(match(normalize('kadai'), issues)).toEqual({ strength: 'exact', via: 'alias' });
  });

  it('ローマ字の読み替えはタイトル本文には当てない', () => {
    expect(match(normalize('kadai'), { text: 'かだい' })).toBeUndefined();
  });

  it('同じ強さならタイトル経由の一致を別名経由より先に選ぶ', () => {
    expect(match(normalize('wiki'), { text: 'Wiki', aliases: ['wiki'] })?.via).toBe('text');
  });

  it('別名の方が強く一致するときは別名経由になる', () => {
    expect(match(normalize('issues'), { text: 'issues 一覧', aliases: ['issues'] })).toEqual({
      strength: 'exact',
      via: 'alias',
    });
  });
});
