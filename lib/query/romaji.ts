const VOWELS = new Set(['a', 'i', 'u', 'e', 'o']);

/**
 * ヘボン式と訓令式の両方を受ける。利用者がどちらで打つかは決められないので、
 * 同じかなに届く綴りはすべて載せる。
 */
const TABLE: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を', wi: 'うぃ', we: 'うぇ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sha: 'しゃ', sya: 'しゃ', shu: 'しゅ', syu: 'しゅ', sho: 'しょ', syo: 'しょ', she: 'しぇ',
  ja: 'じゃ', jya: 'じゃ', zya: 'じゃ', ju: 'じゅ', jyu: 'じゅ', zyu: 'じゅ',
  jo: 'じょ', jyo: 'じょ', zyo: 'じょ', je: 'じぇ',
  cha: 'ちゃ', tya: 'ちゃ', chu: 'ちゅ', tyu: 'ちゅ', cho: 'ちょ', tyo: 'ちょ', che: 'ちぇ',
  dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  fa: 'ふぁ', fi: 'ふぃ', fe: 'ふぇ', fo: 'ふぉ',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  tsa: 'つぁ', tsi: 'つぃ', tse: 'つぇ', tso: 'つぉ',
  thi: 'てぃ', dhi: 'でぃ', thu: 'てゅ', dhu: 'でゅ', twu: 'とぅ', dwu: 'どぅ',
  kwa: 'くぁ', gwa: 'ぐぁ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ',
  la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ',
  xtu: 'っ', ltu: 'っ', xtsu: 'っ', ltsu: 'っ',
};

const LONGEST_KEY = 4;

function isLatin(char: string): boolean {
  return char >= 'a' && char <= 'z';
}

function isConsonant(char: string): boolean {
  return isLatin(char) && !VOWELS.has(char);
}

/** `n` が「ん」で閉じるのは、次にかなの頭になれる文字が続かないとき */
function closesN(next: string | undefined): boolean {
  return next === undefined || !isLatin(next) || (isConsonant(next) && next !== 'y');
}

type Step = { kana: string; length: number };

function stepAt(text: string, index: number): Step {
  const char = text[index] ?? '';
  const next = text[index + 1];

  if (char === 'n') {
    if (next === 'n' || next === "'") return { kana: 'ん', length: 2 };
    if (closesN(next)) return { kana: 'ん', length: 1 };
  }
  if (isConsonant(char) && next === char) return { kana: 'っ', length: 1 };
  if (char === '-') return { kana: 'ー', length: 1 };

  for (let length = LONGEST_KEY; length > 0; length -= 1) {
    const kana = TABLE[text.slice(index, index + length)];
    if (kana !== undefined) return { kana, length };
  }
  return { kana: char, length: 1 };
}

/**
 * ローマ字の並びをひらがなへ写す。変換できない文字（`q` や単独の子音）は
 * そのまま残す。全体を捨てると `kadai1` のような末尾の数字を含む語が届かなくなる。
 */
export function romajiToKana(text: string): string {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index] ?? '';
    if (!isLatin(char) && !(char === '-' && index > 0 && isLatin(text[index - 1] ?? ''))) {
      out += char;
      index += 1;
      continue;
    }
    const step = stepAt(text, index);
    out += step.kana;
    index += step.length;
  }
  return out;
}
