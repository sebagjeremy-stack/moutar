import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface Base {
  id: string;
  etiquette: string;
  /** Masque l'étiquette visuellement (elle reste lue). */
  etiquetteCachee?: boolean;
  aide?: string;
}

/** Un champ de saisie avec son étiquette (toujours présente) et son aide. */
export function Champ({ id, etiquette, etiquetteCachee = false, aide, className = '', ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={id} className={etiquetteCachee ? 'cache-visuel' : 'font-semibold'}>
        {etiquette}
      </label>
      <input id={id} className={`champ ${className}`} aria-describedby={aide ? `${id}-aide` : undefined} {...rest} />
      {aide ? (
        <p id={`${id}-aide`} className="muet">
          {aide}
        </p>
      ) : null}
    </div>
  );
}

export function ZoneTexte({ id, etiquette, etiquetteCachee = false, aide, className = '', ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label htmlFor={id} className={etiquetteCachee ? 'cache-visuel' : 'font-semibold'}>
        {etiquette}
      </label>
      <textarea id={id} className={`champ min-h-[140px] ${className}`} aria-describedby={aide ? `${id}-aide` : undefined} {...rest} />
      {aide ? (
        <p id={`${id}-aide`} className="muet">
          {aide}
        </p>
      ) : null}
    </div>
  );
}
