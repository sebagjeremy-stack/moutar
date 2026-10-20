import { describe, expect, it } from 'vitest';
import { wav } from '../../test/wav';
import { DUREE_MAX_AUDIO_S, TAILLE_MAX_AUDIO, dureeAudioSecondes, typeAudioReel } from './type-audio';

const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(32, 0)]);
const ogg = Buffer.concat([Buffer.from('OggS', 'latin1'), Buffer.alloc(32, 0)]);
const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A ', 'latin1'), Buffer.alloc(16, 0)]);
const mp3 = Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.alloc(32, 0)]);

describe('typeAudioReel (nombres magiques)', () => {
  it('reconnaît WebM (EBML), Ogg, WAV et MP4/M4A par leurs octets', () => {
    expect(typeAudioReel(webm)).toBe('audio/webm');
    expect(typeAudioReel(ogg)).toBe('audio/ogg');
    expect(typeAudioReel(wav(1))).toBe('audio/wav');
    expect(typeAudioReel(mp4)).toBe('audio/mp4');
  });
  it('refuse un MP3, un RIFF qui n’est pas WAVE (WebP), un PNG, un texte et un fichier trop court', () => {
    expect(typeAudioReel(mp3)).toBeNull();
    expect(typeAudioReel(Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.alloc(4), Buffer.from('WEBPVP8 ', 'latin1'), Buffer.alloc(8)]))).toBeNull();
    expect(typeAudioReel(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]))).toBeNull();
    expect(typeAudioReel(Buffer.from('audio/webm mais en texte', 'utf8'))).toBeNull();
    expect(typeAudioReel(Buffer.from([0x1a, 0x45, 0xdf]))).toBeNull();
  });
  it('les limites : 5 Mo, 30 s', () => {
    expect(TAILLE_MAX_AUDIO).toBe(5 * 1024 * 1024);
    expect(DUREE_MAX_AUDIO_S).toBe(30);
  });
});

describe('dureeAudioSecondes (quand le conteneur la dit)', () => {
  it('WAV : taille des données / débit', () => {
    expect(dureeAudioSecondes(wav(1), 'audio/wav')).toBeCloseTo(1, 3);
    expect(dureeAudioSecondes(wav(40, 8_000), 'audio/wav')).toBeCloseTo(40, 3);
  });
  it('MP4 : la boîte mvhd (version 0 : échelle puis durée en 32 bits)', () => {
    const mvhd = Buffer.alloc(4 + 24);
    mvhd.write('mvhd', 0, 'latin1');
    mvhd.writeUInt32BE(1000, 4 + 12);
    mvhd.writeUInt32BE(12_500, 4 + 16);
    expect(dureeAudioSecondes(Buffer.concat([mp4, mvhd]), 'audio/mp4')).toBeCloseTo(12.5, 3);
    expect(dureeAudioSecondes(mp4, 'audio/mp4')).toBeNull();
  });
  it('Ogg Opus : la position de granule de la dernière page à 48 kHz, pré-attente retranchée', () => {
    const premiere = Buffer.alloc(60, 0);
    premiere.write('OggS', 0, 'latin1');
    premiere.write('OpusHead', 28, 'latin1');
    premiere.writeUInt16LE(312, 28 + 10);
    const derniere = Buffer.alloc(40, 0);
    derniere.write('OggS', 0, 'latin1');
    derniere.writeBigUInt64LE(BigInt(48_000 * 35 + 312), 6);
    expect(dureeAudioSecondes(Buffer.concat([premiere, derniere]), 'audio/ogg')).toBeCloseTo(35, 3);
    expect(dureeAudioSecondes(ogg, 'audio/ogg')).toBeNull();
  });
  it('WebM : l’élément Duration (44 89) en unités de TimecodeScale ; absent (MediaRecorder) → null', () => {
    const duration = Buffer.concat([Buffer.from([0x44, 0x89, 0x88]), Buffer.alloc(8)]);
    duration.writeDoubleBE(42_000, 3);
    expect(dureeAudioSecondes(Buffer.concat([webm, duration]), 'audio/webm')).toBeCloseTo(42, 3);
    const echelle = Buffer.from([0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40]); // 1 000 000 ns
    expect(dureeAudioSecondes(Buffer.concat([webm, echelle, duration]), 'audio/webm')).toBeCloseTo(42, 3);
    expect(dureeAudioSecondes(webm, 'audio/webm')).toBeNull();
  });
});
