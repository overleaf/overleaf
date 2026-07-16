import { StateEffect, StateField } from '@codemirror/state'

export type MemberInfo = {
  name: string
  email: string
}

export const projectMembersInfo = StateField.define<Map<string, MemberInfo>>({
  create: () => {
    return new Map()
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(updateCollaboratorsEffect)) {
        value = effect.value
      }
    }
    return value
  },
})

const updateCollaboratorsEffect = StateEffect.define<Map<string, MemberInfo>>()

export const setProjectMembersInfo = (idToNameMap: Map<string, MemberInfo>) => {
  return {
    effects: updateCollaboratorsEffect.of(idToNameMap),
  }
}
