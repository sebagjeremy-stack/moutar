import { describe, expect, it } from 'vitest';
import { ErreurMetier } from '../erreurs/erreur-metier';
import { imageRecue } from './image-recue';

const fichier = (buffer: Buffer, mimetype = 'image/png') => ({ originalname: 'x', mimetype, size: buffer.length, buffer });
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);

function statut(fn: () => unknown): { statut: number; code: unknown } {
  try {
    fn();
  } catch (e) {
    const err = e as ErreurMetier;
    return { statut: err.getStatus(), code: (err.getResponse() as { code: unknown }).code };
  }
  throw new Error('aucune erreur');
}

describe('imageRecue', () => {
  it('sans fichier → 400 image_absente ; fichier vide aussi', () => {
    expect(statut(() => imageRecue(undefined))).toEqual({ statut: 400, code: 'image_absente' });
    expect(statut(() => imageRecue(fichier(Buffer.alloc(0))))).toEqual({ statut: 400, code: 'image_absente' });
  });
  it('un GIF annoncé « image/png » → 415 type_image_refuse (les octets décident)', () => {
    expect(statut(() => imageRecue(fichier(Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(16)]), 'image/png')))).toEqual({ statut: 415, code: 'type_image_refuse' });
  });
  it('un PNG annoncé « application/octet-stream » passe, typé par ses octets', () => {
    expect(imageRecue(fichier(png, 'application/octet-stream'))).toEqual({ octets: png, type: 'image/png' });
  });
});
