import { describe, expect, it } from 'vitest';
import { ErreurMetier } from '../erreurs/erreur-metier';
import { audioRecu } from './audio-recu';
import { wav } from '../../test/wav';

function erreur(f: () => unknown): { statut: number; code: string } {
  try {
    f();
  } catch (e) {
    const err = e as ErreurMetier;
    return { statut: err.getStatus(), code: (err.getResponse() as { code: string }).code };
  }
  throw new Error('aucune erreur');
}

const fichier = (buffer: Buffer) => ({ originalname: 'x.bin', mimetype: 'audio/webm', size: buffer.length, buffer });

describe('audioRecu (champ multipart « audio »)', () => {
  it('absent ou vide → 400 audio_absent', () => {
    expect(erreur(() => audioRecu(undefined))).toEqual({ statut: 400, code: 'audio_absent' });
    expect(erreur(() => audioRecu(fichier(Buffer.alloc(0))))).toEqual({ statut: 400, code: 'audio_absent' });
  });
  it('un MP3 (type annoncé « audio/webm » ignoré) → 415 type_audio_refuse', () => {
    expect(erreur(() => audioRecu(fichier(Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.alloc(32)]))))).toEqual({ statut: 415, code: 'type_audio_refuse' });
  });
  it('un WAV de 40 s → 400 audio_trop_long ; un WAV de 2 s passe, avec le type réel et notre nom de fichier', () => {
    expect(erreur(() => audioRecu(fichier(wav(40, 8_000))))).toEqual({ statut: 400, code: 'audio_trop_long' });
    const a = audioRecu(fichier(wav(2, 8_000)));
    expect(a.type).toBe('audio/wav');
    expect(a.nomFichier).toBe('dictee.wav');
    expect(a.octets.length).toBe(44 + 2 * 8_000 * 2);
  });
  it('un WebM sans durée lisible passe (la taille borne seule)', () => {
    const a = audioRecu(fichier(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32)])));
    expect(a).toMatchObject({ type: 'audio/webm', nomFichier: 'dictee.webm' });
  });
});
