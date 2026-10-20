import { Controller, Get, Param } from '@nestjs/common';
import { schemaEan } from '../produits/produits.controller';
import { AnalyseService, type ResultatAnalyse } from './analyse.service';

@Controller('produits')
export class AnalyseController {
  constructor(private readonly analyse: AnalyseService) {}

  /** Calcule l'analyse de composition, écrit le verdict de niveau 4, le rend AVEC l'avertissement. */
  @Get(':ean/analyse')
  analyser(@Param('ean') ean: string): Promise<ResultatAnalyse> {
    return this.analyse.analyserParEan(schemaEan.parse(ean));
  }
}
