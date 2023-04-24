import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { wrapRanges } from '../../commands/ranges'

export const shortcuts = () => {
  return Prec.high(
    keymap.of([
      {
        key: 'Ctrl-b',
        mac: 'Mod-b',
        preventDefault: true,
        run: wrapRanges('**', '**'),
      },
      {
        key: 'Ctrl-i',
        mac: 'Mod-i',
        preventDefault: true,
        run: wrapRanges('_', '_'),
      },
    ])
  )
}
