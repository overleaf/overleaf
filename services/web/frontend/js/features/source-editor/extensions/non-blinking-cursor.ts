import { StateEffect, StateField, TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const nonBlinkingCursorEffect = StateEffect.define<boolean>()

const nonBlinkingCursorTheme = EditorView.baseTheme({
  '&.cm-non-blinking-cursor .cm-cursorLayer': {
    animationName: 'none !important',
  },
})

const nonBlinkingCursorField = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(nonBlinkingCursorEffect)) {
        value = effect.value
      }
    }
    return value
  },
  provide(field) {
    return [
      EditorView.editorAttributes.from(field, field => ({
        class: field ? 'cm-non-blinking-cursor' : '',
      })),
      nonBlinkingCursorTheme,
    ]
  },
})

export const setNonBlinkingCursor = (enabled: boolean): TransactionSpec => ({
  effects: nonBlinkingCursorEffect.of(enabled),
})

export const nonBlinkingCursor = () => nonBlinkingCursorField
