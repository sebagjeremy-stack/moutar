import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { LimiteProduits } from '../produits/limite-produits';
import { schemaEan } from '../produits/produits.controller';
import { AnalyseService, type ResultatAnalyse } from './analyse.service';

@Controller('produits')
export class AnalyseController {
  constructor(
    private readonly analyse: AnalyseService,
    private readonly limite: LimiteProduits,
  ) {}

  /** Calcule l'analyse de composition, écrit le verdict de niveau 4, le rend AVEC l'avertissement. 120 / 10 min par adresse. */
  @Get(':ean/analyse')
  analyser(@Param('ean') ean: string, @Req() req: Request): Promise<ResultatAnalyse> {
    const e = schemaEan.parse(ean);
    this.limite.exigerAnalyse(req.ip ?? 'inconnue');
    return this.analyse.analyserParEan(e);
  }
}
