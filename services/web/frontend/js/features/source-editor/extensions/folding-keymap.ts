import { foldAll, toggleFold, unfoldAll } from '@codemirror/language'

export const foldingKeymap = [
  {
    key: 'F2',
    run: toggleFold,
  },
  {
    key: 'Alt-Shift-1',
    run: foldAll,
  },
  {
    key: 'Alt-Shift-0',
    run: unfoldAll,
  },
]
