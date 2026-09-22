/**
 * Le filet 1px est le SEUL séparateur autorisé du design system.
 * Composant plutôt que classe brute pour rendre l'interdiction visible :
 * si quelqu'un écrit une box-shadow, ça se voit à la revue.
 */
export function Rule({ vertical = false }: { vertical?: boolean }) {
  return <hr className={vertical ? 'rule--v' : 'rule'} aria-hidden="true" />
}
