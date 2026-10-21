import { readFileSync } from 'node:fs';
import type { BrowserContext } from '@playwright/test';
import { ETAT_ADMIN } from './_base';

/**
 * La session de la console, REJOUÉE, jamais rouverte : la connexion est limitée à 10 essais par quart d'heure, par e-mail
 * et par adresse (`AdminService`). Le projet `setup` se connecte UNE fois et enregistre les cookies dans `.devstack/e2e/`
 * (ignoré par git) ; le projet `console` les charge par `storageState`, et un test du projet `mobile` qui a besoin de la
 * console les rejoue par `sessionAdmin`. Aucun `POST /admin/connexion` dans un test.
 */
type EtatEnregistre = { cookies: Parameters<BrowserContext['addCookies']>[0] };

export async function sessionAdmin(context: BrowserContext): Promise<void> {
  const etat = JSON.parse(readFileSync(ETAT_ADMIN, 'utf8')) as EtatEnregistre;
  await context.clearCookies();
  await context.addCookies(etat.cookies);
}
