/**
 * Le type RÉEL d'un audio reçu (lot 4, transcription de secours), lu dans ses OCTETS — jamais dans l'extension ni dans le
 * type annoncé par le navigateur : WebM (ce que `MediaRecorder` rend sur Chrome et Firefox), Ogg (Opus ou Vorbis), WAV,
 * MP4/M4A (Safari). Un audio pèse 5 Mo au plus (`TAILLE_MAX_AUDIO`) et dure 30 s au plus QUAND la durée se lit dans le
 * conteneur (`dureeAudioSecondes` : WAV par son en-tête, MP4 par `mvhd`, Ogg par la position de granule de la dernière
 * page, WebM par l'élément `Duration` de l'EBML s'il est écrit — `MediaRecorder` ne l'écrit pas toujours : la taille borne alors seule).
 */
export type TypeAudio = 'audio/webm' | 'audio/ogg' | 'audio/wav' | 'audio/mp4';

export const TYPES_AUDIO: readonly TypeAudio[] = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4'];

export const TAILLE_MAX_AUDIO = 5 * 1024 * 1024;
export const DUREE_MAX_AUDIO_S = 30;

/** L'extension d'un nom de fichier pour chaque type (Whisper lit le conteneur par le nom qu'on lui donne). */
export const EXTENSION_AUDIO: Record<TypeAudio, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mp4': 'm4a' };

/** Le type d'un audio d'après ses premiers octets, ou null si ce n'est aucun des quatre conteneurs admis. */
export function typeAudioReel(octets: Buffer): TypeAudio | null {
  if (octets.length < 12) return null;
  // EBML (WebM / Matroska) : 1A 45 DF A3.
  if (octets[0] === 0x1a && octets[1] === 0x45 && octets[2] === 0xdf && octets[3] === 0xa3) return 'audio/webm';
  if (octets.subarray(0, 4).toString('latin1') === 'OggS') return 'audio/ogg';
  if (octets.subarray(0, 4).toString('latin1') === 'RIFF' && octets.subarray(8, 12).toString('latin1') === 'WAVE') return 'audio/wav';
  // ISO BMFF : la taille de la boîte, puis « ftyp » ; M4A, MP4, 3GP, QuickTime (Safari rend `audio/mp4`).
  if (octets.subarray(4, 8).toString('latin1') === 'ftyp') return 'audio/mp4';
  return null;
}

/** La durée en secondes QUAND le conteneur la dit ; null quand elle ne se lit pas (la taille borne alors seule). */
export function dureeAudioSecondes(octets: Buffer, type: TypeAudio): number | null {
  try {
    if (type === 'audio/wav') return dureeWav(octets);
    if (type === 'audio/mp4') return dureeMp4(octets);
    if (type === 'audio/ogg') return dureeOgg(octets);
    return dureeWebm(octets);
  } catch {
    return null;
  }
}

/** WAV : les blocs « fmt  » (débit en octets par seconde) et « data » (taille) ; durée = taille / débit. */
function dureeWav(o: Buffer): number | null {
  let pos = 12;
  let debit: number | null = null;
  while (pos + 8 <= o.length) {
    const id = o.subarray(pos, pos + 4).toString('latin1');
    const taille = o.readUInt32LE(pos + 4);
    if (id === 'fmt ' && pos + 16 <= o.length) debit = o.readUInt32LE(pos + 16);
    if (id === 'data') {
      if (!debit) return null;
      // Une taille « data » plus grande que le fichier (flux non fini) : on compte ce qui est là.
      const donnees = Math.min(taille, o.length - pos - 8);
      return donnees / debit;
    }
    pos += 8 + taille + (taille % 2);
  }
  return null;
}

/** MP4 : la boîte `mvhd` (dans `moov`) porte l'échelle de temps et la durée ; version 1 = 64 bits. */
function dureeMp4(o: Buffer): number | null {
  const i = o.indexOf('mvhd', 0, 'latin1');
  if (i === -1) return null;
  const version = o[i + 4];
  if (version === 1) {
    if (i + 4 + 28 + 8 > o.length) return null;
    const echelle = o.readUInt32BE(i + 4 + 20);
    const duree = Number(o.readBigUInt64BE(i + 4 + 24));
    return echelle ? duree / echelle : null;
  }
  if (i + 4 + 20 > o.length) return null;
  const echelle = o.readUInt32BE(i + 4 + 12);
  const duree = o.readUInt32BE(i + 4 + 16);
  return echelle ? duree / echelle : null;
}

/**
 * Ogg : la position de granule de la DERNIÈRE page (octets 6-13, petit-boutiste) compte des échantillons — à 48 kHz pour
 * Opus (toujours), au taux de l'en-tête d'identification pour Vorbis (octet 15 de la première page de données).
 */
function dureeOgg(o: Buffer): number | null {
  const derniere = o.lastIndexOf('OggS', o.length, 'latin1');
  if (derniere === -1 || derniere + 14 > o.length) return null;
  const granule = Number(o.readBigUInt64LE(derniere + 6));
  if (granule <= 0) return null;
  let taux: number | null = null;
  const opus = o.indexOf('OpusHead', 0, 'latin1');
  if (opus !== -1 && opus < 200) {
    taux = 48_000;
    // Opus : la pré-attente (pre-skip, octets 10-11 de l'en-tête) se retranche.
    const preSkip = opus + 12 <= o.length ? o.readUInt16LE(opus + 10) : 0;
    return Math.max(0, granule - preSkip) / taux;
  }
  const vorbis = o.indexOf('\x01vorbis', 0, 'latin1');
  if (vorbis !== -1 && vorbis + 16 <= o.length) taux = o.readUInt32LE(vorbis + 11);
  return taux ? granule / taux : null;
}

/**
 * WebM : dans les 64 premiers Ko, l'élément `Duration` (ID 44 89, flottant 4 ou 8 octets) en unités de `TimecodeScale`
 * (ID 2A D7 B1, défaut 1 000 000 ns). Absent (flux de `MediaRecorder`) → null.
 */
function dureeWebm(o: Buffer): number | null {
  const zone = o.subarray(0, Math.min(o.length, 64 * 1024));
  let echelleNs = 1_000_000;
  const e = zone.indexOf(Buffer.from([0x2a, 0xd7, 0xb1]));
  if (e !== -1 && e + 3 < zone.length) {
    const longueur = zone[e + 3] & 0x7f;
    if (longueur >= 1 && longueur <= 4 && e + 4 + longueur <= zone.length) echelleNs = zone.readUIntBE(e + 4, longueur);
  }
  let d = zone.indexOf(Buffer.from([0x44, 0x89]));
  while (d !== -1 && d + 2 < zone.length) {
    const longueur = zone[d + 2];
    if (longueur === 0x84 && d + 7 <= zone.length) return (zone.readFloatBE(d + 3) * echelleNs) / 1e9;
    if (longueur === 0x88 && d + 11 <= zone.length) return (zone.readDoubleBE(d + 3) * echelleNs) / 1e9;
    d = zone.indexOf(Buffer.from([0x44, 0x89]), d + 1);
  }
  return null;
}
