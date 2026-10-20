import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { LigneListe, ListeOfficielle } from '@moutar/shared-types';
import { codeListeEnum } from '../../database/schema';
import { AdminGuard, type RequeteAdmin } from '../admin/admin.guard';
import type { ResultatAnalyseListe } from './analyse-liste-commun';
import { ListesService } from './listes.service';
import type { FichierRecu } from './pdf-texte';

/** Un fichier de liste (PDF, texte, CSV) pèse 10 Mo au plus : au-delà, 413 `fichier_trop_grand`. */
export const TAILLE_MAX_FICHIER = 10 * 1024 * 1024;

const videVersNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const schemaJour = z.preprocess(videVersNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'jour attendu : AAAA-MM-JJ').nullable().optional());
const schemaTexteCourt = (max: number) => z.preprocess(videVersNull, z.string().trim().max(max).nullable().optional());
const schemaBool = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());

const schemaLigne = z.object({
  rubrique: z.string().trim().min(1).max(200),
  marque: schemaTexteCourt(200),
  produitLibelle: schemaTexteCourt(300),
  mention: schemaTexteCourt(300),
  touteMarque: schemaBool.default(false),
  rubriqueReservee: schemaBool.default(false),
});

const schemaSource = z.object({
  code: z.enum(codeListeEnum.enumValues),
  format: z.enum(['auto', 'texte', 'csv']).default('auto'),
  texte: z.preprocess(videVersNull, z.string().max(2_000_000).nullable().optional()),
});

const schemaImport = schemaSource.extend({
  titre: z.string().trim().min(1).max(200),
  publieLe: schemaJour,
  valableJusquAu: schemaJour,
  fichierNom: schemaTexteCourt(300),
  noteSource: schemaTexteCourt(4000),
  /** Les lignes corrigées à l'aperçu (JSON, ou texte JSON dans un champ multipart) ; absentes : le fichier ou le texte est analysé. */
  lignes: z.preprocess((v) => (typeof v === 'string' ? JSON.parse(v) : v), z.array(schemaLigne).max(20_000).optional()),
});

const schemaModification = z.object({
  titre: z.string().trim().min(1).max(200).optional(),
  publieLe: schemaJour,
  valableJusquAu: schemaJour,
  noteSource: schemaTexteCourt(4000),
  active: z.boolean().optional(),
});

const schemaLigneModification = schemaLigne.partial().extend({ ordre: z.number().int().min(0).optional() });
const schemaUuid = z.string().uuid();

/** La console des listes officielles : tout sous la garde de session (`AdminGuard`). */
@Controller('admin/listes')
@UseGuards(AdminGuard)
export class ListesAdminController {
  constructor(private readonly listes: ListesService) {}

  @Get()
  async lister(): Promise<{ compte: number; listes: ListeOfficielle[] }> {
    const listes = await this.listes.lister();
    return { compte: listes.length, listes };
  }

  /** Aperçu : les lignes analysées et les avertissements, SANS rien écrire. Multipart (`fichier`) ou JSON (`texte`). */
  @Post('apercu')
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_FICHIER, files: 1 } }))
  apercu(@Body() corps: unknown, @UploadedFile() fichier?: FichierRecu): Promise<ResultatAnalyseListe & { fichierNom: string | null }> {
    const s = schemaSource.parse(corps ?? {});
    return this.listes.apercu({ code: s.code, format: s.format, texte: s.texte ?? null, fichier: fichier ?? null });
  }

  /** Import : les lignes corrigées (ou le fichier / texte, analysé ici) ; l'ancienne liste du même code devient inactive. */
  @Post()
  @UseInterceptors(FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_FICHIER, files: 1 } }))
  async importer(@Body() corps: unknown, @Req() req: RequeteAdmin, @UploadedFile() fichier?: FichierRecu): Promise<ListeOfficielle> {
    const i = schemaImport.parse(corps ?? {});
    let lignes = i.lignes;
    let fichierNom = i.fichierNom ?? fichier?.originalname ?? null;
    let noteSource = i.noteSource ?? null;
    if (!lignes) {
      const a = await this.listes.apercu({ code: i.code, format: i.format, texte: i.texte ?? null, fichier: fichier ?? null });
      lignes = a.lignes;
      fichierNom = fichierNom ?? a.fichierNom;
      noteSource = noteSource ?? a.note;
    }
    return this.listes.importer(
      {
        code: i.code,
        titre: i.titre,
        publieLe: i.publieLe ?? null,
        valableJusquAu: i.valableJusquAu ?? null,
        fichierNom,
        noteSource,
        lignes: lignes.map((l, ordre) => ({ rubrique: l.rubrique, marque: l.marque ?? null, produitLibelle: l.produitLibelle ?? null, mention: l.mention ?? null, touteMarque: l.touteMarque, rubriqueReservee: l.rubriqueReservee, ordre })),
      },
      req.admin!,
    );
  }

  @Get(':id')
  lire(@Param('id') id: string): Promise<ListeOfficielle> {
    return this.listes.lire(schemaUuid.parse(id));
  }

  @Put(':id')
  modifier(@Param('id') id: string, @Body() corps: unknown, @Req() req: RequeteAdmin): Promise<ListeOfficielle> {
    const c = schemaModification.parse(corps ?? {});
    return this.listes.modifier(schemaUuid.parse(id), c, req.admin!);
  }

  @Get(':id/lignes')
  lignes(@Param('id') id: string, @Query('q') q?: string): Promise<{ liste: ListeOfficielle; compte: number; lignes: LigneListe[] }> {
    return this.listes.lignes(schemaUuid.parse(id), q ?? null);
  }

  @Post(':id/lignes')
  ajouterLigne(@Param('id') id: string, @Body() corps: unknown, @Req() req: RequeteAdmin): Promise<LigneListe> {
    const l = schemaLigne.parse(corps ?? {});
    return this.listes.ajouterLigne(schemaUuid.parse(id), { rubrique: l.rubrique, marque: l.marque ?? null, produitLibelle: l.produitLibelle ?? null, mention: l.mention ?? null, touteMarque: l.touteMarque, rubriqueReservee: l.rubriqueReservee }, req.admin!);
  }

  @Put(':id/lignes/:ligneId')
  modifierLigne(@Param('id') id: string, @Param('ligneId') ligneId: string, @Body() corps: unknown, @Req() req: RequeteAdmin): Promise<LigneListe> {
    const c = schemaLigneModification.parse(corps ?? {});
    return this.listes.modifierLigne(schemaUuid.parse(id), schemaUuid.parse(ligneId), c, req.admin!);
  }

  @Delete(':id/lignes/:ligneId')
  retirerLigne(@Param('id') id: string, @Param('ligneId') ligneId: string, @Req() req: RequeteAdmin): Promise<{ ok: true }> {
    return this.listes.retirerLigne(schemaUuid.parse(id), schemaUuid.parse(ligneId), req.admin!);
  }
}
