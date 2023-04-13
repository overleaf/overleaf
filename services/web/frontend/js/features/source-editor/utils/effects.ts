import { StateEffectType, Transaction } from '@codemirror/state'
import { ViewUpdate } from '@codemirror/view'

export const hasEffect =
  <T>(effectType: StateEffectType<T>) =>
  (tr: Transaction) =>
    tr.effects.some(effect => effect.is(effectType))

export const updateHasEffect =
  <T>(effectType: StateEffectType<T>) =>
  (update: ViewUpdate) =>
    update.transactions.some(tr =>
      tr.effects.some(effect => effect.is(effectType))
    )

export const findEffect =
  <T>(effectType: StateEffectType<T>) =>
  (tr: Transaction) =>
    tr.effects.find(effect => effect.is(effectType))
