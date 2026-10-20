import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { statutAdditifEnum } from '../../database/schema';
import { optionsCookie } from '../../common/auth/cookies';
import { loadEnv } from '../../config/env';
import { ProduitsService } from '../produits/produits.service';
import { AdminGuard, type RequeteAdmin } from './admin.guard';
import { AdminService, type SessionLue } from './admin.service';
import { COOKIE_ADMIN, DUREE_SESSION_MS } from './session-admin';

const schemaConnexion = z.object({ email: z.string().trim().email().max(200), motDePasse: z.string().min(1).max(200) });
const schemaSurcharge = z.object({
  statut: z.enum(statutAdditifEnum.enumValues),
  source: z.string().trim().min(1).max(500),
  note: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(1000).nullable().optional()),
});
const schemaCode = z.string().regex(/^E\d{3,4}[a-z]?$/, 'code E attendu');
const schemaSurchargeCertificateur = z.object({
  actif: z.boolean(),
  note: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(1000).nullable().optional()),
});
const schemaCodeCertificateur = z.string().regex(/^[a-z_]{2,50}$/, 'code de certificateur attendu');
const schemaPage = z.coerce.number().int().min(1).max(100_000).default(1);

/** La connexion, seule route de la console sans garde. */
@Controller('admin')
export class AdminConnexionController {
  constructor(private readonly admin: AdminService) {}

  @Post('connexion')
  async connexion(@Body() corps: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionLue> {
    const c = schemaConnexion.parse(corps);
    const { jeton, session } = await this.admin.connexion(c.email, c.motDePasse, req.ip ?? 'inconnue');
    res.cookie(COOKIE_ADMIN, jeton, optionsCookie(loadEnv().NODE_ENV === 'production', DUREE_SESSION_MS));
    return session;
  }
}

/** Tout le reste de `/api/v1/admin/*` : session relue en base à chaque requête. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly produits: ProduitsService,
  ) {}

  @Post('deconnexion')
  @HttpCode(200)
  async deconnexion(@Req() req: RequeteAdmin, @Res({ passthrough: true }) res: Response): Promise<{ ok: true }> {
    await this.admin.deconnexion(req.admin!);
    res.clearCookie(COOKIE_ADMIN, { path: '/' });
    return { ok: true };
  }

  @Get('moi')
  moi(@Req() req: RequeteAdmin): SessionLue {
    return req.admin!;
  }

  @Get('additifs')
  additifs() {
    return this.admin.additifs();
  }

  @Put('additifs/:code')
  surcharger(@Param('code') code: string, @Body() corps: unknown, @Req() req: RequeteAdmin) {
    const v = schemaSurcharge.parse(corps);
    return this.admin.surchargerAdditif(schemaCode.parse(code), { statut: v.statut, source: v.source, note: v.note ?? null }, req.admin!);
  }

  /** Lot 3 : le catalogue des certificateurs et ses surcharges (actif, note). */
  @Get('certificateurs')
  certificateurs() {
    return this.admin.certificateurs();
  }

  @Get('certificateurs/:code')
  async certificateur(@Param('code') code: string) {
    const c = (await this.admin.certificateurs()).find((x) => x.code === schemaCodeCertificateur.parse(code));
    if (!c) throw new NotFoundException({ code: 'certificateur_inconnu', message: 'Certificateur inconnu du catalogue.' });
    return c;
  }

  @Put('certificateurs/:code')
  surchargerCertificateur(@Param('code') code: string, @Body() corps: unknown, @Req() req: RequeteAdmin) {
    const v = schemaSurchargeCertificateur.parse(corps ?? {});
    return this.admin.surchargerCertificateur(schemaCodeCertificateur.parse(code), { actif: v.actif, note: v.note ?? null }, req.admin!);
  }

  @Get('produits')
  async produitsRecents() {
    const lignes = await this.produits.derniers(50);
    return { compte: lignes.length, produits: lignes };
  }

  @Get('journal')
  journal() {
    return this.admin.journal();
  }

  /** Lot 5 : le journal du moteur d'IA, lecture seule, 50 par page (`?page=`), sans contenu. */
  @Get('journal-ia')
  journalIa(@Query('page') page?: string) {
    return this.admin.journalIa(schemaPage.parse(page));
  }

  /** Lot 5 : le tableau de bord — des comptes, jamais une personne. */
  @Get('tableau')
  tableau() {
    return this.admin.tableau();
  }

  /** Réservé : aucune suppression de journal n'existe (ajout seul) — la route répond 405 pour le dire. */
  @Delete('journal')
  pasDeSuppression(@Res() res: Response): void {
    res.status(405).json({ code: 'journal_ajout_seul', message: 'Le journal est en ajout seul.' });
  }
}
