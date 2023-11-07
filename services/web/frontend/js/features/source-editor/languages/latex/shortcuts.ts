import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { toggleRanges } from '../../commands/ranges'

export const shortcuts = () => {
  return Prec.high(
    keymap.of([
      {
        key: 'Ctrl-b',
        mac: 'Mod-b',
        preventDefault: true,
        run: toggleRanges('\\textbf'),
      },
      {
        key: 'Ctrl-i',
        mac: 'Mod-i',
        preventDefault: true,
        run: toggleRanges('\\textit'),
      },
    ])
  )
}
