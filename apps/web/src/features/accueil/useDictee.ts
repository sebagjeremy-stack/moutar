import { useCallback, useEffect, useRef, useState } from 'react';
import { appel } from '../../lib/api';
import { phraseErreur } from '../../lib/erreurs';

/**
 * La dictée (lot 4) : la Web Speech API du navigateur (`SpeechRecognition` / `webkitSpeechRecognition`, `fr-FR`, non
 * continue, un seul résultat) ; le texte reconnu va au champ de recherche, qui déclenche les suggestions. Rien n'est
 * gardé : ni audio, ni texte, hors du champ.
 * Sans reconnaissance dans le navigateur : le SECOURS serveur (`POST /api/v1/transcriptions`, lot 4 serveur) — un
 * `audio/webm` enregistré par `MediaRecorder`, envoyé puis oublié — seulement si la route répond (sondée une fois, à vide :
 * 404 ou 501 = absente, et l'état dit « Votre navigateur ne dicte pas ; tapez le nom »). Tolérant : tout ce qui n'est pas
 * un texte rendu finit en phrase française, jamais en « aucun ».
 */
export type EtatDictee =
  | { phase: 'indisponible'; message: string }
  | { phase: 'pret'; mode: 'navigateur' | 'serveur' }
  | { phase: 'ecoute'; mode: 'navigateur' | 'serveur' }
  | { phase: 'envoi' }
  | { phase: 'echec'; message: string };

export const MESSAGE_INDISPONIBLE = 'Votre navigateur ne dicte pas ; tapez le nom.';
/** Un enregistrement envoyé au serveur ne dépasse pas huit secondes (un nom de produit, une marque). */
export const DUREE_MAX_ENREGISTREMENT_MS = 8000;
export const ROUTE_TRANSCRIPTIONS = '/api/v1/transcriptions';

interface ReconnaissanceResultat {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Reconnaissance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: ReconnaissanceResultat) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructeurReconnaissance = new () => Reconnaissance;

function constructeurNavigateur(): ConstructeurReconnaissance | null {
  const w = globalThis as { SpeechRecognition?: ConstructeurReconnaissance; webkitSpeechRecognition?: ConstructeurReconnaissance };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function enregistreurPossible(): boolean {
  const w = globalThis as { MediaRecorder?: unknown };
  return typeof w.MediaRecorder === 'function' && typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

const ERREURS_RECONNAISSANCE: Readonly<Record<string, string>> = {
  'not-allowed': 'Le micro est refusé : autorisez-le dans les réglages du navigateur, ou tapez le nom.',
  'service-not-allowed': 'La dictée n’est pas permise sur ce navigateur : tapez le nom.',
  'audio-capture': 'Aucun micro trouvé : tapez le nom.',
  'no-speech': 'Rien n’a été entendu : parlez après avoir appuyé, ou tapez le nom.',
  network: 'La dictée a besoin du réseau : réessayez, ou tapez le nom.',
  aborted: 'Dictée interrompue.',
};

export function useDictee(surTexte: (texte: string) => void): { etat: EtatDictee; demarrer: () => void; arreter: () => void } {
  const [etat, setEtat] = useState<EtatDictee>(() => (constructeurNavigateur() ? { phase: 'pret', mode: 'navigateur' } : enregistreurPossible() ? { phase: 'pret', mode: 'serveur' } : { phase: 'indisponible', message: MESSAGE_INDISPONIBLE }));
  const reconnaissance = useRef<Reconnaissance | null>(null);
  const enregistreur = useRef<{ arreter: () => void } | null>(null);
  const routeServeur = useRef<'inconnue' | 'presente' | 'absente'>('inconnue');
  const surTexteRef = useRef(surTexte);
  surTexteRef.current = surTexte;

  // Quitter l'écran coupe tout : rien ne continue d'écouter.
  useEffect(
    () => () => {
      reconnaissance.current?.abort();
      enregistreur.current?.arreter();
    },
    [],
  );

  const arreter = useCallback(() => {
    reconnaissance.current?.stop();
    enregistreur.current?.arreter();
  }, []);

  const demarrerNavigateur = useCallback((C: ConstructeurReconnaissance) => {
    const r = new C();
    r.lang = 'fr-FR';
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    let rendu = false;
    r.onresult = (e) => {
      const texte = Array.from({ length: e.results.length }, (_, i) => e.results[i]?.[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (texte) {
        rendu = true;
        surTexteRef.current(texte);
      }
    };
    r.onerror = (e) => {
      const code = e.error ?? '';
      setEtat({ phase: 'echec', message: ERREURS_RECONNAISSANCE[code] ?? 'La dictée a échoué : réessayez, ou tapez le nom.' });
      rendu = true;
    };
    r.onend = () => {
      reconnaissance.current = null;
      setEtat((s) => (s.phase === 'echec' ? s : rendu ? { phase: 'pret', mode: 'navigateur' } : { phase: 'echec', message: ERREURS_RECONNAISSANCE['no-speech'] }));
    };
    reconnaissance.current = r;
    setEtat({ phase: 'ecoute', mode: 'navigateur' });
    try {
      r.start();
    } catch {
      reconnaissance.current = null;
      setEtat({ phase: 'echec', message: 'La dictée n’a pas pu démarrer : réessayez, ou tapez le nom.' });
    }
  }, []);

  const demarrerServeur = useCallback(async () => {
    // La route est sondée une fois, à vide : absente (404, 501, réseau) → indisponible, sans rien enregistrer.
    if (routeServeur.current === 'inconnue') {
      const sonde = await appel<unknown>(ROUTE_TRANSCRIPTIONS, { method: 'POST', body: new FormData() });
      const presente = sonde.ok || [400, 413, 415, 422, 429].includes(sonde.statut);
      routeServeur.current = presente ? 'presente' : 'absente';
    }
    if (routeServeur.current === 'absente') {
      setEtat({ phase: 'indisponible', message: MESSAGE_INDISPONIBLE });
      return;
    }
    let flux: MediaStream;
    try {
      flux = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setEtat({ phase: 'echec', message: ERREURS_RECONNAISSANCE['not-allowed'] });
      return;
    }
    const R = (globalThis as { MediaRecorder: new (s: MediaStream, o?: { mimeType?: string }) => MediaRecorder }).MediaRecorder;
    const type = typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined;
    const rec = new R(flux, type ? { mimeType: type } : undefined);
    const morceaux: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) morceaux.push(e.data);
    };
    const fini = new Promise<Blob>((resoudre) => {
      rec.onstop = () => resoudre(new Blob(morceaux, { type: rec.mimeType || 'audio/webm' }));
    });
    const minuteur = setTimeout(() => rec.state !== 'inactive' && rec.stop(), DUREE_MAX_ENREGISTREMENT_MS);
    enregistreur.current = {
      arreter: () => {
        clearTimeout(minuteur);
        if (rec.state !== 'inactive') rec.stop();
      },
    };
    setEtat({ phase: 'ecoute', mode: 'serveur' });
    rec.start();
    const audio = await fini;
    enregistreur.current = null;
    flux.getTracks().forEach((t) => t.stop());
    setEtat({ phase: 'envoi' });
    const fd = new FormData();
    fd.append('audio', audio, 'dictee.webm');
    const r = await appel<{ texte?: string }>(ROUTE_TRANSCRIPTIONS, { method: 'POST', body: fd });
    // L'audio n'existe plus qu'ici : il part avec la requête, rien n'est gardé.
    if (!r.ok) {
      setEtat(r.statut === 404 || r.statut === 501 ? { phase: 'indisponible', message: MESSAGE_INDISPONIBLE } : { phase: 'echec', message: phraseErreur(r) });
      return;
    }
    const texte = typeof r.data?.texte === 'string' ? r.data.texte.trim() : '';
    if (!texte) {
      setEtat({ phase: 'echec', message: ERREURS_RECONNAISSANCE['no-speech'] });
      return;
    }
    surTexteRef.current(texte);
    setEtat({ phase: 'pret', mode: 'serveur' });
  }, []);

  const demarrer = useCallback(() => {
    if (etat.phase === 'ecoute' || etat.phase === 'envoi') return;
    const C = constructeurNavigateur();
    if (C) {
      demarrerNavigateur(C);
      return;
    }
    if (enregistreurPossible()) {
      void demarrerServeur();
      return;
    }
    setEtat({ phase: 'indisponible', message: MESSAGE_INDISPONIBLE });
  }, [etat.phase, demarrerNavigateur, demarrerServeur]);

  return { etat, demarrer, arreter };
}
