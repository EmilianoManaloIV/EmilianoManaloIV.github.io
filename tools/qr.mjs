// A small QR Code encoder (ISO/IEC 18004, Model 2), used at build time only to draw
// the conference card's QR code (ADR 0011). Byte mode, error correction level M,
// versions 1 to 10: enough for any address on this site. Pure, no dependencies.

// Per version 1..10 at level M: error-correction codewords per block, and blocks.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

// == GF(256) arithmetic with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D).

const EXP = new Array(512);
const LOG = new Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
export const gfMul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
export const gfPow = (i) => EXP[i % 255];

// Reed-Solomon: the generator has roots a^0 .. a^(n-1); the ECC is the remainder of
// data * x^n divided by it.
export function reedSolomon(data, n) {
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], gfPow(i));
    }
    gen = next;
  }
  const rem = new Array(n).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift();
    rem.push(0);
    for (let j = 0; j < n; j++) rem[j] ^= gfMul(gen[j + 1], factor);
  }
  return rem;
}

// == Capacity

export const sizeOf = (version) => version * 4 + 17;

// Modules left for data and ECC once every function pattern is placed.
function rawModules(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

export const dataCodewords = (version) => Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[version] * BLOCKS[version];

// Centres of the alignment patterns along each axis.
export function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = sizeOf(version) - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
}

// == Data: byte mode, then the terminator, padding, and ECC, interleaved by block.

export function encodeData(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let version = 1;
  const countBits = (v) => (v <= 9 ? 8 : 16);
  while (4 + countBits(version) + bytes.length * 8 > dataCodewords(version) * 8) {
    if (++version > MAX_VERSION) throw new Error(`QR: "${text}" is too long for version ${MAX_VERSION}`);
  }
  const bits = [];
  const put = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4);
  put(bytes.length, countBits(version));
  for (const b of bytes) put(b, 8);
  const capacity = dataCodewords(version) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));

  // Split into blocks (the last ones one codeword longer), add ECC, and interleave.
  const blocks = BLOCKS[version];
  const ecc = ECC_PER_BLOCK[version];
  const total = Math.floor(rawModules(version) / 8);
  const shortLen = Math.floor(total / blocks) - ecc;
  const shortCount = blocks - (total % blocks);
  const parts = [];
  for (let b = 0, at = 0; b < blocks; b++) {
    const len = shortLen + (b < shortCount ? 0 : 1);
    const block = data.slice(at, at + len);
    at += len;
    parts.push({ data: block, ecc: reedSolomon(block, ecc) });
  }
  const out = [];
  for (let i = 0; i <= shortLen; i++) for (const p of parts) if (i < p.data.length) out.push(p.data[i]);
  for (let i = 0; i < ecc; i++) for (const p of parts) out.push(p.ecc[i]);
  return { version, codewords: out, data };
}

// == Format and version information

// Level M is 0b00; the 15 bits are BCH(15,5) coded and XORed with 0x5412.
export function formatBits(mask) {
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

export function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | rem;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// == The matrix

function build(version, codewords, mask) {
  const size = sizeOf(version);
  const dark = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, on) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    dark[y][x] = on;
    fixed[y][x] = true;
  };
  // Finder patterns with their light separators, in three corners.
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
  }
  // Alignment patterns, except where they would overlap a finder.
  const align = alignmentPositions(version);
  for (const ay of align) {
    for (const ax of align) {
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    set(i, 6, i % 2 === 0);
    set(6, i, i % 2 === 0);
  }
  // Format information (both copies) and the dark module.
  const format = formatBits(mask);
  const bit = (value, i) => ((value >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(format, i));
  set(8, 7, bit(format, 6));
  set(8, 8, bit(format, 7));
  set(7, 8, bit(format, 8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(format, i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(format, i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(format, i));
  set(8, size - 8, true);
  // Version information, from version 7.
  if (version >= 7) {
    const v = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(v, i));
      set(b, a, bit(v, i));
    }
  }
  // Data, in two-column zigzags from the bottom right, skipping the timing column.
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (fixed[y][x]) continue;
        const on = i < codewords.length * 8 && ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
        dark[y][x] = on !== MASKS[mask](x, y);
      }
    }
  }
  return dark;
}

// == Penalty (the four rules of the standard), to pick the most scannable mask.

export function penalty(dark) {
  const size = dark.length;
  let score = 0;
  const lines = [];
  for (let y = 0; y < size; y++) lines.push(dark[y]);
  for (let x = 0; x < size; x++) lines.push(dark.map((row) => row[x]));
  for (const line of lines) {
    // Rule 1: runs of five or more of one colour.
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    // Rule 3: finder-like 1:1:3:1:1 runs with four light modules beside them.
    const s = line.map((d) => (d ? "1" : "0")).join("");
    const padded = `0000${s}0000`;
    for (const pattern of ["10111010000", "00001011101"]) {
      for (let at = padded.indexOf(pattern); at !== -1; at = padded.indexOf(pattern, at + 1)) score += 40;
    }
  }
  // Rule 2: 2x2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = dark[y][x];
      if (c === dark[y][x + 1] && c === dark[y + 1][x] && c === dark[y + 1][x + 1]) score += 3;
    }
  }
  // Rule 4: balance of dark and light.
  const total = size * size;
  const darkCount = dark.flat().filter(Boolean).length;
  score += (Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1) * 10;
  return score;
}

// The finished symbol: every mask is tried and the lowest penalty wins.
// `masks` limits the choice (tests use it to score every mask on its own).
export function qrMatrix(text, { masks = [0, 1, 2, 3, 4, 5, 6, 7] } = {}) {
  const { version, codewords } = encodeData(text);
  let best = null;
  for (const mask of masks) {
    const dark = build(version, codewords, mask);
    const score = penalty(dark);
    if (!best || score < best.score) best = { version, mask, score, dark };
  }
  return best;
}

// An SVG with a four-module white quiet zone, black modules in one path, and crisp
// edges, so it scans from a phone screen or a print in either site theme.
export function qrSvg(text, { title = text } = {}) {
  const { dark } = qrMatrix(text);
  const quiet = 4;
  const size = dark.length + quiet * 2;
  let path = "";
  dark.forEach((row, y) => row.forEach((on, x) => on && (path += `M${x + quiet} ${y + quiet}h1v1h-1z`)));
  const escaped = String(title).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size * 8}" height="${size * 8}" shape-rendering="crispEdges">
<title>${escaped}</title>
<rect width="${size}" height="${size}" fill="#fff"/>
<path fill="#000" d="${path}"/>
</svg>
`;
}
