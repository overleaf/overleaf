import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { toggleWrapRanges } from './toggle-marks'

export const shortcuts = () => {
  return Prec.high(
    keymap.of([
      {
        key: 'Ctrl-b',
        mac: 'Mod-b',
        preventDefault: true,
        run: toggleWrapRanges('**', '**', 'StrongEmphasis'),
      },
      {
        key: 'Ctrl-i',
        mac: 'Mod-i',
        preventDefault: true,
        run: toggleWrapRanges('_', '_', 'Emphasis'),
      },
    ])
  )
}
