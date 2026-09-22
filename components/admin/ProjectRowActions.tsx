'use client'

import { deleteProjectAction } from '@/app/admin/projects/actions'

/**
 * La suppression demande une confirmation.
 * confirm() natif : c'est une action admin à un seul utilisateur, une
 * modale maison coûterait 80 lignes pour zéro gain fonctionnel.
 */
export function ProjectRowActions({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteProjectAction}
      onSubmit={(e) => {
        if (!confirm(`Supprimer définitivement « ${title} » ?`)) e.preventDefault()
      }}
      style={{ display: 'inline' }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="mono"
        style={{
          background: 'none',
          border: 0,
          cursor: 'pointer',
          color: 'var(--color-vermilion)',
        }}
      >
        Supprimer
      </button>
    </form>
  )
}
