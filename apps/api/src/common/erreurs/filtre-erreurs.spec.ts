import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { erreurDuBodyParser } from './filtre-erreurs';

describe('erreurDuBodyParser', () => {
  it('un corps trop grand → 413 corps_trop_grand', () => {
    expect(erreurDuBodyParser(Object.assign(new Error('request entity too large'), { type: 'entity.too.large', status: 413 }))).toMatchObject({ statut: 413, code: 'corps_trop_grand' });
  });
  it('un JSON illisible → 400 requete_invalide', () => {
    expect(erreurDuBodyParser(Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed', status: 400 }))).toMatchObject({ statut: 400, code: 'requete_invalide' });
    expect(erreurDuBodyParser(new SyntaxError('x'))).toMatchObject({ statut: 400 });
    // Nest a déjà transformé le SyntaxError en BadRequestException sans code.
    expect(erreurDuBodyParser(new BadRequestException('Unexpected end of JSON input'))).toMatchObject({ statut: 400, code: 'requete_invalide' });
  });
  it('une 400 ou 403 qui porte son code reste à elle', () => {
    expect(erreurDuBodyParser(new BadRequestException({ code: 'ean_invalide', message: 'x' }))).toBeNull();
    expect(erreurDuBodyParser(new ForbiddenException({ code: 'session_invalide', message: 'x' }))).toBeNull();
  });
  it('le reste passe', () => {
    expect(erreurDuBodyParser(new Error('autre'))).toBeNull();
    expect(erreurDuBodyParser(null)).toBeNull();
  });
});
