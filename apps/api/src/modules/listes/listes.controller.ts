import { Body, Controller, Delete, Get, HttpCode, Injectable, Param, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { z } from 'zod';
import type { LigneListe, ListeOfficielle } from '@moutar/shared-types';
import { ErreurMetier } from '../../common/erreurs/erreur-metier';
import { codeListeEnum } from '../../database/schema';
import { AdminGuard, type RequeteAdmin } from '../admin/admin.guard';
import type { ResultatAnalyseListe } from './analyse-liste-commun';
import { ListesService, nomFichierSur } from './listes.service';
import type { FichierRecu } from './pdf-texte';

/** Un fichier de liste (PDF, texte, CSV) pèse 10 Mo au plus : au-delà, 413 `fichier_trop_grand`. */
export const TAILLE_MAX_FICHIER = 10 * 1024 * 1024;

/**
 * Le multipart d'une liste : UN fichier sous le champ `fichier`. Les refus de multer deviennent des 400 `requete_invalide`
 * en français (« un seul fichier », « le champ s'appelle fichier ») au lieu du 400 anonyme de Nest, que le filtre global
 * lirait comme « JSON illisible » ; la taille reste au filtre (413 `fichier_trop_grand`).
 */
@Injectable()
export class FichierDeListeInterceptor implements NestInterceptor {
  private readonly interne: NestInterceptor = new (FileInterceptor('fichier', { limits: { fileSize: TAILLE_MAX_FICHIER, files: 1 } }))();

  async intercept(contexte: ExecutionContext, suite: CallHandler): Promise<Observable<unknown>> {
    try {
      return await this.interne.intercept(contexte, suite);
    } catch (e) {
      throw traduireRefusMultipart(e);
    }
  }
}

/** Pure : le refus de multer (déjà transformé par Nest en `BadRequestException(message anglais)`) → notre 400 avec un code ; le reste passe tel quel. */
export function traduireRefusMultipart(e: unknown): unknown {
  const message = e instanceof Error ? e.message : '';
  if (/too many files/i.test(message)) return new ErreurMetier(400, 'requete_invalide', 'Un seul fichier à la fois.', { details: ['fichier: un seul fichier'] });
  if (/unexpected field/i.test(message)) return new ErreurMetier(400, 'requete_invalide', 'Le fichier doit être envoyé sous le champ « fichier ».', { details: ['fichier: champ attendu « fichier »'] });
  if (/too many (parts|fields)|field (name|value) too long/i.test(message)) return new ErreurMetier(400, 'requete_invalide', 'Le formulaire envoyé est trop grand ou mal formé.', { details: [message] });
  return e;
}

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
  /** Le titre, s'il est déjà saisi : l'analyse ignore les lignes qui lui sont égales (en-tête répété). */
  titre: schemaTexteCourt(200),
});

/** Les lignes d'un multipart arrivent en texte JSON : un JSON illisible est un 400 `requete_invalide` qui le dit (`details`), jamais une 500. */
const lignesJson = (v: unknown, ctx: z.RefinementCtx): unknown => {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch (e) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `JSON illisible (${e instanceof Error ? e.message : 'erreur de syntaxe'})` });
    return z.NEVER;
  }
};

const schemaImport = schemaSource.extend({
  titre: z.string().trim().min(1).max(200),
  publieLe: schemaJour,
  valableJusquAu: schemaJour,
  fichierNom: schemaTexteCourt(300),
  noteSource: schemaTexteCourt(4000),
  /** Les lignes corrigées à l'aperçu (JSON, ou texte JSON dans un champ multipart) ; absentes : le fichier ou le texte est analysé. */
  lignes: z.preprocess(lignesJson, z.array(schemaLigne).max(20_000).optional()),
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

  /** Aperçu : les lignes analysées et les avertissements, SANS rien écrire (200, rien n'est créé). Multipart (`fichier`) ou JSON (`texte`). */
  @Post('apercu')
  @HttpCode(200)
  @UseInterceptors(FichierDeListeInterceptor)
  apercu(@Body() corps: unknown, @UploadedFile() fichier?: FichierRecu): Promise<ResultatAnalyseListe & { fichierNom: string | null }> {
    const s = schemaSource.parse(corps ?? {});
    return this.listes.apercu({ code: s.code, format: s.format, texte: s.texte ?? null, fichier: fichier ?? null, titre: s.titre ?? null });
  }

  /** Import : les lignes corrigées (ou le fichier / texte, analysé ici) ; l'ancienne liste du même code devient inactive. */
  @Post()
  @UseInterceptors(FichierDeListeInterceptor)
  async importer(@Body() corps: unknown, @Req() req: RequeteAdmin, @UploadedFile() fichier?: FichierRecu): Promise<ListeOfficielle> {
    const i = schemaImport.parse(corps ?? {});
    let lignes = i.lignes;
    let fichierNom = nomFichierSur(i.fichierNom ?? fichier?.originalname);
    let noteSource = i.noteSource ?? null;
    if (!lignes) {
      const a = await this.listes.apercu({ code: i.code, format: i.format, texte: i.texte ?? null, fichier: fichier ?? null, titre: i.titre });
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

  /** Les lignes (5 000 au plus) ; `compte` est le compte réel, `tronque` dit si tout n'est pas servi. */
  @Get(':id/lignes')
  lignes(@Param('id') id: string, @Query('q') q?: string): Promise<{ liste: ListeOfficielle; compte: number; lignes: LigneListe[]; tronque: boolean }> {
    return this.listes.lignes(schemaUuid.parse(id), typeof q === 'string' ? q.slice(0, 200) : null);
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
