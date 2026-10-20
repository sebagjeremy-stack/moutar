import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { ResultatRecherche } from '@moutar/shared-types';
import { LimiteDeDebit } from '../../common/auth/limite-de-debit';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { RechercheService } from './recherche.service';

/** Limite LARGE, par adresse : 120 recherches par minute (une famille derrière une box n'y bute jamais). */
export const RECHERCHES_PAR_MINUTE = 120;

/** `GET /api/v1/recherche?q=` : publique, sans compte ; aucune donnée personnelle ne s'y lit ni ne s'y écrit. */
@Controller('recherche')
export class RechercheController {
  private readonly parAdresse = new LimiteDeDebit(RECHERCHES_PAR_MINUTE, 60_000);

  constructor(private readonly recherche: RechercheService) {}

  @Get()
  chercher(@Query('q') q: string | undefined, @Req() req: Request): Promise<ResultatRecherche> {
    if (!this.parAdresse.tenter(req.ip ?? 'inconnue')) throw new ErreurMetier(429, 'trop_de_demandes', 'Trop de recherches : patientez une minute.');
    return this.recherche.chercher(typeof q === 'string' ? q.slice(0, 200) : '');
  }
}
