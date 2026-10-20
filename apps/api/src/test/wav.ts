/** Outil des tests (lot 4) : un WAV PCM 16 bits mono de `secondes` à `hz`, silencieux. */
export function wav(secondes: number, hz = 16_000): Buffer {
  const data = Buffer.alloc(Math.round(secondes * hz) * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0, 'latin1');
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8, 'latin1');
  h.write('fmt ', 12, 'latin1');
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(hz, 24);
  h.writeUInt32LE(hz * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36, 'latin1');
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

