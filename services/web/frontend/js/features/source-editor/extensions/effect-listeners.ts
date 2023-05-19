import { StateEffect, StateEffectType, StateField } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

type EffectListenerOptions = {
  once: boolean
}

type EffectListener = {
  effect: StateEffectType<any>
  callback: (value: any) => any
  options?: EffectListenerOptions
}

const addEffectListenerEffect = StateEffect.define<EffectListener>()
const removeEffectListenerEffect = StateEffect.define<EffectListener>()

export const effectListeners = () => [effectListenersField]

const effectListenersField = StateField.define<EffectListener[]>({
  create: () => [],
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(addEffectListenerEffect)) {
        value.push(effect.value)
      }
      if (effect.is(removeEffectListenerEffect)) {
        value = value.filter(
          listener =>
            !(
              listener.effect === effect.value.effect &&
              listener.callback === effect.value.callback
            )
        )
      }
      for (let i = 0; i < value.length; ++i) {
        const listener = value[i]
        if (effect.is(listener.effect)) {
          // Invoke the callback after the transaction
          setTimeout(() => listener.callback(effect.value))
          if (listener.options?.once) {
            // Remove the effectListener
            value.splice(i, 1)
            // Keep index the same for the next iteration, since we've removed
            // an element
            --i
          }
        }
      }
    }
    return value
  },
})

export const addEffectListener = <T>(
  view: EditorView,
  effect: StateEffectType<T>,
  callback: (value: T) => any,
  options?: EffectListenerOptions
) => {
  view.dispatch({
    effects: addEffectListenerEffect.of({ effect, callback, options }),
  })
}

export const removeEffectListener = <T>(
  view: EditorView,
  effect: StateEffectType<T>,
  callback: (value: T) => any
) => {
  view.dispatch({
    effects: removeEffectListenerEffect.of({ effect, callback }),
  })
}
