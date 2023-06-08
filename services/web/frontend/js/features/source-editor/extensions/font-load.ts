import { ViewPlugin } from '@codemirror/view'
import { StateEffect } from '@codemirror/state'
import { updateHasEffect } from '../utils/effects'

const fontLoadEffect = StateEffect.define<readonly FontFace[]>()
export const hasFontLoadedEffect = updateHasEffect(fontLoadEffect)

/**
 * A custom extension that listens for an event indicating that fonts have finished loading,
 * then dispatches an effect which other extensions can use to recalculate values.
 */
export const fontLoad = ViewPlugin.define(view => {
  function listener(this: FontFaceSet, event: FontFaceSetLoadEvent) {
    view.dispatch({ effects: fontLoadEffect.of(event.fontfaces) })
  }

  const fontLoadSupport = 'fonts' in document
  if (fontLoadSupport) {
    // TypeScript doesn't appear to know the correct type for the listener
    document.fonts.addEventListener('loadingdone', listener as EventListener)
  }

  return {
    destroy() {
      if (fontLoadSupport) {
        document.fonts.removeEventListener(
          'loadingdone',
          listener as EventListener
        )
      }
    },
  }
})
