import { Annotation, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { toggleRanges } from '../../commands/ranges'

export const shortcuts = () => {
  return Prec.high(
    keymap.of([
      {
        key: 'Ctrl-b',
        mac: 'Mod-b',
        preventDefault: true,
        run: toggleRanges('\\textbf', runShortcut.of('toggle-bold')),
      },
      {
        key: 'Ctrl-i',
        mac: 'Mod-i',
        preventDefault: true,
        run: toggleRanges('\\textit', runShortcut.of('toggle-italic')),
      },
    ])
  )
}

export const runShortcut = Annotation.define<string>()
