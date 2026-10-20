/** Un emoji DÉCORATIF (un par carte au plus) : jamais lu par un lecteur d'écran, jamais porteur d'un sens — le mot est à côté. */
export function Emoji({ children, className = '' }: { children: string; className?: string }) {
  return (
    <span className={`emoji ${className}`} aria-hidden="true">
      {children}
    </span>
  );
}
