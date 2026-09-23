import type { CSSProperties } from 'react'

/**
 * Primitive de motion M1 : révélation typographique masquée.
 *
 * Chaque ligne est enveloppée dans un conteneur overflow:hidden ; la
 * ligne monte depuis sous le masque, avec un décalage de 60 ms par ligne.
 *
 * Entièrement CSS (cf. .reveal-line dans globals.css) : ce composant
 * reste un Server Component, zéro JavaScript client.
 */
export function RevealLines({
  text,
  className = '',
}: {
  text: string
  className?: string
}) {
  const lines = text.split('\n').filter(Boolean)

  return (
    <span className={className}>
      {lines.map((line, i) => (
        <span className="reveal-line" key={line}>
          <span style={{ '--i': i } as CSSProperties}>{line}</span>
        </span>
      ))}
    </span>
  )
}
