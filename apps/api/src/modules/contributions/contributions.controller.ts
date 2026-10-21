import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import type { ContributionProposee, ContributionsProduit, SignalementCree } from '@moutar/shared-types';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { hotesPreuve, loadEnv } from '../../config/env';
import { jourLocal, jourReel } from '../../common/temps/jour-local';
import { sourceContributionEnum, statutContributionEnum } from '../../database/schema';
import { schemaEan } from '../produits/produits.controller';
import { preuveUrlAdmise } from '@moutar/shared-types/regles/preuve';
import { AUTEUR_NOM_MAX, SIGNALEMENT_TEXTE_MAX, SOURCE_TEXTE_MAX } from './contributions-regles';
import { ContributionsService } from './contributions.service';
import { LimiteContributions } from './limite-contributions';
import { SignalementsService } from './signalements.service';

const videVersNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Ce que le public envoie ; les textes sont nettoyés en texte brut par le service, la preuve vérifiée ici (400 `preuve_refusee`). */
export const schemaProposition = z.object({
  statutPropose: z.enum(statutContributionEnum.enumValues),
  sourceType: z.enum(sourceContributionEnum.enumValues).default('lbpc'),
  sourceTexte: z.string().trim().min(1).max(SOURCE_TEXTE_MAX),
  sourceDate: z.preprocess(videVersNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'jour attendu : AAAA-MM-JJ').nullable().optional()),
  preuveUrl: z.preprocess(videVersNull, z.string().trim().max(2000).nullable().optional()),
  auteurNom: z.preprocess(videVersNull, z.string().trim().max(AUTEUR_NOM_MAX).nullable().optional()),
});

export const schemaSignalement = z.object({
  niveau: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  texte: z.string().trim().min(1).max(SIGNALEMENT_TEXTE_MAX),
});

/**
 * Pure : le jour de la source, ou null ; un jour qui n'existe pas (2026-13-45, 31 avril) ou qui n'est pas encore venu à la
 * pendule du centre → 400 `date_invalide`. Comparé en jours ISO, jamais par `Date` (qui corrige en silence et lit le fuseau).
 */
export function verifierSourceDate(jour: string | null | undefined, aujourdhui: string = jourLocal()): string | null {
  if (!jour) return null;
  if (!jourReel(jour)) throw new ErreurMetier(400, 'date_invalide', 'Le jour de la source n’existe pas : AAAA-MM-JJ, un jour du calendrier.', { sourceDate: jour });
  if (jour > aujourdhui) throw new ErreurMetier(400, 'date_invalide', 'Le jour de la source est dans le futur : il ne peut pas dépasser aujourd’hui.', { sourceDate: jour, aujourdhui });
  return jour;
}

/** Pure : un pseudonyme ne contient pas d'« @ » (ce n'est ni un e-mail ni un identifiant) → 400 `pseudonyme_invalide`. */
export function verifierPseudonyme(nom: string | null | undefined): string | null {
  if (!nom) return null;
  if (nom.includes('@')) throw new ErreurMetier(400, 'pseudonyme_invalide', 'Un pseudonyme, pas votre nom ni votre e-mail : retirez le « @ ».');
  return nom;
}

/** Pure : la preuve admise (normalisée) ou null ; un lien hors liste ou non https → 400 `preuve_refusee`. */
export function verifierPreuve(brute: string | null | undefined, hotes: readonly string[]): string | null {
  if (!brute) return null;
  const admise = preuveUrlAdmise(brute, hotes);
  if (!admise) throw new ErreurMetier(400, 'preuve_refusee', `Le lien de preuve doit être en https et pointer vers ${hotes.join(' ou ')}.`, { hotesAdmis: [...hotes] });
  return admise;
}

/** Routes PUBLIQUES du lot 5 : proposer une contribution, lire les validées, signaler une erreur. Aucune donnée personnelle. */
@Controller('produits')
export class ContributionsController {
  constructor(
    private readonly contributions: ContributionsService,
    private readonly signalements: SignalementsService,
    private readonly limite: LimiteContributions,
  ) {}

  @Get(':ean/contributions')
  lire(@Param('ean') ean: string): Promise<ContributionsProduit> {
    return this.contributions.publiquesParEan(schemaEan.parse(ean));
  }

  @Post(':ean/contributions')
  proposer(@Param('ean') ean: string, @Body() corps: unknown, @Req() req: Request): Promise<ContributionProposee> {
    const e = schemaEan.parse(ean);
    const c = schemaProposition.parse(corps ?? {});
    // Une requête refusée (zod, date, pseudonyme, preuve) ne compte pas dans la limite.
    const sourceDate = verifierSourceDate(c.sourceDate);
    const auteurNom = verifierPseudonyme(c.auteurNom);
    const preuveUrl = verifierPreuve(c.preuveUrl, hotesPreuve(loadEnv()));
    this.limite.exigerContribution(req.ip ?? 'inconnue');
    return this.contributions.proposer(e, { statutPropose: c.statutPropose, sourceType: c.sourceType, sourceTexte: c.sourceTexte, sourceDate, preuveUrl, auteurNom });
  }

  @Post(':ean/signalements')
  signaler(@Param('ean') ean: string, @Body() corps: unknown, @Req() req: Request): Promise<SignalementCree> {
    const e = schemaEan.parse(ean);
    const s = schemaSignalement.parse(corps ?? {});
    this.limite.exigerSignalement(req.ip ?? 'inconnue');
    return this.signalements.signaler(e, s);
  }
}
