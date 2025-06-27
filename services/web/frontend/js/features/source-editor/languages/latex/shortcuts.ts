import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { toggleRanges } from '../../commands/ranges'

/**
 * For future commands try not to use commands that are already in use by Vim, Emacs, and other editors
 * @returns a keymap of the command shortcuts you want
 */
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
      //This command is for the text color feature
      {
        key: 'Ctrl-;',
        mac: 'Mod-;',
        preventDefault: true,
        run: toggleRanges('\\textcolor'),
      },
    ])
  )
}
