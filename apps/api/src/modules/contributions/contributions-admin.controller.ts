import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import type { ContributionConsole, SignalementConsole } from '@moutar/shared-types';
import { etatContributionEnum, etatSignalementEnum } from '../../database/schema';
import { AdminGuard, type RequeteAdmin } from '../admin/admin.guard';
import { ContributionsService } from './contributions.service';
import { SignalementsService } from './signalements.service';

const schemaUuid = z.string().uuid();
const schemaEtatContribution = z.enum(etatContributionEnum.enumValues).default('proposee');
const schemaEtatSignalement = z.enum(etatSignalementEnum.enumValues).default('ouvert');
const schemaDecision = z.object({
  etat: z.enum(['validee', 'refusee']),
  motifRefus: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().trim().max(500).nullable().optional()),
});
const schemaTraitement = z.object({ etat: z.literal('traite') });

/** La console des contributions et des signalements (lot 5), sous la garde de session ; chaque décision est journalisée. */
@Controller('admin')
@UseGuards(AdminGuard)
export class ContributionsAdminController {
  constructor(
    private readonly contributions: ContributionsService,
    private readonly signalements: SignalementsService,
  ) {}

  @Get('contributions')
  contributions_(@Query('etat') etat?: string): Promise<ContributionConsole[]> {
    return this.contributions.console(schemaEtatContribution.parse(etat));
  }

  @Put('contributions/:id')
  decider(@Param('id') id: string, @Body() corps: unknown, @Req() req: RequeteAdmin): Promise<ContributionConsole> {
    const d = schemaDecision.parse(corps ?? {});
    return this.contributions.decider(schemaUuid.parse(id), { etat: d.etat, motifRefus: d.etat === 'refusee' ? (d.motifRefus ?? null) : null }, req.admin!);
  }

  @Get('signalements')
  signalements_(@Query('etat') etat?: string): Promise<SignalementConsole[]> {
    return this.signalements.console(schemaEtatSignalement.parse(etat));
  }

  @Put('signalements/:id')
  traiter(@Param('id') id: string, @Body() corps: unknown, @Req() req: RequeteAdmin): Promise<SignalementConsole> {
    schemaTraitement.parse(corps ?? {});
    return this.signalements.traiter(schemaUuid.parse(id), req.admin!);
  }
}
