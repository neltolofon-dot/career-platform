'use client'

import { deleteSkillAction } from '@/app/admin/skills/actions'

/**
 * confirm() natif : c'est une action admin à un seul utilisateur, une
 * modale maison coûterait 80 lignes pour zéro gain fonctionnel.
 */
export function SkillRowActions({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteSkillAction}
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
