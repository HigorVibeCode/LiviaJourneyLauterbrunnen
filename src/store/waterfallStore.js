import { create } from 'zustand'

/**
 * Campos de corrente das cachoeiras — Livia aplica força se estiver dentro de algum.
 */
export const useWaterfallStore = create((set, get) => ({
  fields: [],

  registerField: (id, field) => {
    set((state) => ({
      fields: [...state.fields.filter((f) => f.id !== id), { id, ...field }],
    }))
  },

  unregisterField: (id) => {
    set((state) => ({
      fields: state.fields.filter((f) => f.id !== id),
    }))
  },

  getActiveFieldAt: (pos) => {
    return get().fields.find((field) => isInsideField(pos, field)) ?? null
  },
}))

function isInsideField(pos, field) {
  const { center, halfExtents } = field
  return (
    Math.abs(pos.x - center[0]) <= halfExtents[0] &&
    Math.abs(pos.y - center[1]) <= halfExtents[1] &&
    Math.abs(pos.z - center[2]) <= halfExtents[2]
  )
}

export function isInsideWaterfall(pos, field) {
  if (!field) return false
  return isInsideField(pos, field)
}
