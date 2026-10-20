import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { AdminGuard, type RequeteAdmin } from './admin.guard';
import type { AdminService, SessionLue } from './admin.service';

const ctxPour = (req: RequeteAdmin): ExecutionContext => ({ switchToHttp: () => ({ getRequest: () => req }) }) as unknown as ExecutionContext;
const serviceAvec = (sessions: Record<string, SessionLue>): AdminService =>
  ({ sessionDepuisJeton: async (jeton: string) => sessions[jeton] ?? null }) as unknown as AdminService;

describe('AdminGuard', () => {
  const session: SessionLue = { sessionId: 's1', compteId: 'c1', email: 'a@b.fr', nom: 'A' };
  const garde = new AdminGuard(serviceAvec({ bon: session }));

  it('401 sans cookie', async () => {
    await expect(garde.canActivate(ctxPour({ headers: {} }))).rejects.toMatchObject({ status: 401 });
  });
  it('403 sur une session révoquée ou inconnue', async () => {
    await expect(garde.canActivate(ctxPour({ headers: { cookie: 'moutar_admin=revoque' } }))).rejects.toMatchObject({ status: 403 });
  });
  it('laisse passer une session valide et la pose sur la requête', async () => {
    const req: RequeteAdmin = { headers: { cookie: 'autre=1; moutar_admin=bon' } };
    await expect(garde.canActivate(ctxPour(req))).resolves.toBe(true);
    expect(req.admin?.email).toBe('a@b.fr');
  });
});
