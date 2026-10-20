import { describe, expect, it } from 'vitest';
import { TAILLE_MAX_IMAGE, typeImageReel } from './type-image';

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 1)]);
const webp = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 ', 'latin1'), Buffer.alloc(8, 0)]);
const gif = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(16, 0)]);

describe('typeImageReel (nombres magiques)', () => {
  it('reconnaît PNG, JPEG et WebP par leurs octets', () => {
    expect(typeImageReel(png)).toBe('image/png');
    expect(typeImageReel(jpeg)).toBe('image/jpeg');
    expect(typeImageReel(webp)).toBe('image/webp');
  });
  it('refuse un GIF, un PDF, un texte, un RIFF qui n’est pas WebP, et un fichier trop court', () => {
    expect(typeImageReel(gif)).toBeNull();
    expect(typeImageReel(Buffer.from('%PDF-1.4 ........', 'latin1'))).toBeNull();
    expect(typeImageReel(Buffer.from('image/png mais en texte', 'utf8'))).toBeNull();
    expect(typeImageReel(Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WAVE', 'latin1'), Buffer.alloc(8)]))).toBeNull();
    expect(typeImageReel(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
  });
  it('la limite est de 8 Mo', () => {
    expect(TAILLE_MAX_IMAGE).toBe(8 * 1024 * 1024);
  });
});
