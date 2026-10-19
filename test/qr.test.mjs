import { test } from "node:test";
import assert from "node:assert/strict";
import { gfMul, gfPow, reedSolomon, dataCodewords, alignmentPositions, encodeData, formatBits, versionBits, qrMatrix, penalty, qrSvg, sizeOf } from "../tools/qr.mjs";

// Evaluates a codeword polynomial (highest power first) at x.
const evaluate = (poly, x) => poly.reduce((acc, c) => gfMul(acc, x) ^ c, 0);

test("Reed-Solomon codewords vanish at every root of the generator", () => {
  for (const n of [10, 16, 26]) {
    const data = Array.from({ length: 30 }, (_, i) => (i * 37 + n) & 0xff);
    const word = [...data, ...reedSolomon(data, n)];
    for (let i = 0; i < n; i++) assert.equal(evaluate(word, gfPow(i)), 0, `syndrome ${i} of ${n}`);
    // Changing one byte breaks it, so the check is not vacuous.
    word[3] ^= 1;
    assert.ok([...Array(n).keys()].some((i) => evaluate(word, gfPow(i)) !== 0));
  }
});

test("capacity, alignment positions, format and version bits match the standard", () => {
  assert.deepEqual([1, 2, 3, 4, 10].map(dataCodewords), [16, 28, 44, 64, 216]);
  assert.deepEqual(alignmentPositions(1), []);
  assert.deepEqual(alignmentPositions(2), [6, 18]);
  assert.deepEqual(alignmentPositions(7), [6, 22, 38]);
  assert.deepEqual(alignmentPositions(10), [6, 28, 50]);
  // Level M, mask 0 is the published 101010000010010; every format word is a BCH codeword.
  // The standard's table of level-M format words, masks 0 to 7.
  const published = [
    0b101010000010010, 0b101000100100101, 0b101111001111100, 0b101101101001011,
    0b100010111111001, 0b100000011001110, 0b100111110010111, 0b100101010100000,
  ];
  assert.deepEqual([...Array(8).keys()].map(formatBits), published);
  for (let mask = 0; mask < 8; mask++) {
    let v = formatBits(mask) ^ 0x5412;
    for (let i = 14; i >= 10; i--) if ((v >>> i) & 1) v ^= 0x537 << (i - 10);
    assert.equal(v, 0, `format for mask ${mask}`);
  }
  assert.deepEqual([7, 8, 9, 10].map(versionBits), [0x07c94, 0x085bc, 0x09a99, 0x0a4d3]);
});

test("versions are chosen by length, and too much text is refused", () => {
  assert.equal(encodeData("https://emilianomanaloiv.github.io/").version, 3);
  assert.equal(encodeData("a".repeat(14)).version, 1);
  assert.equal(encodeData("a".repeat(15)).version, 2);
  assert.throws(() => encodeData("a".repeat(300)), /too long/);
});

// An independent reader: format bits from the first copy, then unmask and walk the
// zigzag, skipping function modules found by their known positions.
function readBack(dark, version) {
  const size = dark.length;
  let format = 0;
  const cells = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  cells.forEach(([x, y], i) => (format |= (dark[y][x] ? 1 : 0) << i));
  const mask = (format ^ 0x5412) >>> 10 & 7;
  const second = [];
  for (let i = 0; i < 8; i++) second.push(dark[8][size - 1 - i]);
  for (let i = 8; i < 15; i++) second.push(dark[size - 15 + i][8]);
  assert.equal(second.reduce((acc, d, i) => acc | ((d ? 1 : 0) << i), 0), format, "both format copies agree");
  const align = alignmentPositions(version);
  const isFunction = (x, y) => {
    if ((x < 9 && y < 9) || (x >= size - 8 && y < 9) || (x < 9 && y >= size - 8)) return true;
    if (x === 6 || y === 6) return true;
    for (const ay of align) for (const ax of align) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) continue;
      if (Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2) return true;
    }
    return false;
  };
  const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!isFunction(x, y)) bits.push(dark[y][x] !== masks[mask](x, y) ? 1 : 0);
      }
    }
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  return { mask, bytes };
}

test("the finished symbol reads back to the encoded codewords and the address", () => {
  const text = "https://emilianomanaloiv.github.io/";
  const { version, mask, dark } = qrMatrix(text);
  assert.equal(dark.length, sizeOf(version));
  // Finder corners are dark, their separators light, and the timing row alternates.
  for (const [x, y] of [[0, 0], [dark.length - 1, 0], [0, dark.length - 1]]) assert.ok(dark[y][x]);
  assert.equal(dark[7][7], false);
  for (let i = 8; i < dark.length - 8; i++) assert.equal(dark[6][i], i % 2 === 0);
  const back = readBack(dark, version);
  assert.equal(back.mask, mask);
  const { codewords, data } = encodeData(text);
  assert.deepEqual(back.bytes.slice(0, codewords.length), codewords);
  // Byte mode (0100), the length, then the address itself.
  const bits = data.map((b) => b.toString(2).padStart(8, "0")).join("");
  assert.equal(bits.slice(0, 4), "0100");
  assert.equal(parseInt(bits.slice(4, 12), 2), text.length);
  const decoded = [];
  for (let i = 0; i < text.length; i++) decoded.push(parseInt(bits.slice(12 + i * 8, 20 + i * 8), 2));
  assert.equal(String.fromCharCode(...decoded), text);
});

test("the lowest-penalty mask is chosen, and the SVG has a quiet zone", () => {
  const best = qrMatrix("https://emilianomanaloiv.github.io/");
  for (let mask = 0; mask < 8; mask++) {
    const one = qrMatrix("https://emilianomanaloiv.github.io/", { masks: [mask] });
    assert.equal(one.score, penalty(one.dark));
    assert.ok(best.score <= one.score, `mask ${mask} scores lower than the chosen ${best.mask}`);
  }
  const svg = qrSvg("https://emilianomanaloiv.github.io/");
  const size = sizeOf(best.version) + 8;
  assert.match(svg, new RegExp(`viewBox="0 0 ${size} ${size}"`));
  assert.match(svg, /<rect width="\d+" height="\d+" fill="#fff"\/>/);
  assert.match(svg, /<path fill="#000" d="M4 4h1v1h-1z/);
});

// A fuller reader for every version: its own map of function modules (finders,
// separators, format and version areas, timing, alignment), the second format copy,
// de-interleaving, a syndrome check per block, and byte-mode decoding.
const ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLK = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MASK = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];

function decode(dark, version) {
  const size = dark.length;
  const align = alignmentPositions(version);
  const fn = (x, y) =>
    (x < 9 && y < 9) || (x >= size - 8 && y < 9) || (x < 9 && y >= size - 8) || x === 6 || y === 6 ||
    (version >= 7 && ((x >= size - 11 && x <= size - 9 && y < 6) || (y >= size - 11 && y <= size - 9 && x < 6))) ||
    align.some((ay) => align.some((ax) => !((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) && Math.abs(x - ax) <= 2 && Math.abs(y - ay) <= 2));
  assert.ok(dark[size - 8][8], "the dark module");
  let format = 0;
  for (let i = 0; i < 8; i++) format |= (dark[8][size - 1 - i] ? 1 : 0) << i;
  for (let i = 8; i < 15; i++) format |= (dark[size - 15 + i][8] ? 1 : 0) << i;
  format ^= 0x5412;
  assert.equal(format >>> 13, 0b00, "level M");
  const mask = (format >>> 10) & 7;
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fn(x, y)) bits.push(dark[y][x] !== MASK[mask](x, y) ? 1 : 0);
      }
    }
  }
  const total = Math.floor(bits.length / 8);
  const words = [];
  for (let i = 0; i < total; i++) words.push(bits.slice(i * 8, i * 8 + 8).reduce((a, b) => (a << 1) | b, 0));
  const blocks = BLK[version];
  const ecc = ECC[version];
  const shortData = Math.floor(total / blocks) - ecc;
  const shortCount = blocks - (total % blocks);
  const parts = Array.from({ length: blocks }, (_, b) => ({ len: shortData + (b < shortCount ? 0 : 1), data: [], ecc: [] }));
  let at = 0;
  for (let i = 0; i <= shortData; i++) for (const p of parts) if (i < p.len) p.data.push(words[at++]);
  for (let i = 0; i < ecc; i++) for (const p of parts) p.ecc.push(words[at++]);
  for (const p of parts) {
    const word = [...p.data, ...p.ecc];
    for (let i = 0; i < ecc; i++) assert.equal(evaluate(word, gfPow(i)), 0, `v${version}: block syndrome ${i}`);
  }
  const stream = parts.flatMap((p) => p.data).map((b) => b.toString(2).padStart(8, "0")).join("");
  assert.equal(stream.slice(0, 4), "0100", "byte mode");
  const countBits = version <= 9 ? 8 : 16;
  const count = parseInt(stream.slice(4, 4 + countBits), 2);
  const bytes = [];
  for (let i = 0; i < count; i++) bytes.push(parseInt(stream.slice(4 + countBits + i * 8, 12 + countBits + i * 8), 2));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

test("every version 1 to 10 round-trips at its capacity edges", () => {
  const capacity = [0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213];
  for (let version = 1; version <= 10; version++) {
    for (const length of [capacity[version], capacity[version] + 1]) {
      if (length > 213) continue;
      const text = Array.from({ length }, (_, i) => "https://em.example/ABCxyz-0123456789_/?=&"[i % 41]).join("");
      const { version: v, dark } = qrMatrix(text);
      assert.equal(v, length === capacity[version] ? version : version + 1, `${length} bytes`);
      assert.equal(decode(dark, v), text, `v${v}, ${length} bytes`);
    }
  }
  // Multibyte text counts bytes, not characters.
  const accented = "Café — Señor ✓";
  assert.equal(decode(qrMatrix(accented).dark, qrMatrix(accented).version), accented);
});
