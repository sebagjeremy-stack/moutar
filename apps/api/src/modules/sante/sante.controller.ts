import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class SanteController {
  @Get()
  sante(): { statut: 'ok'; application: 'moutar' } {
    return { statut: 'ok', application: 'moutar' };
  }
}
