import { LanguageDescription } from '@codemirror/language'

export const languages = [
  LanguageDescription.of({
    name: 'latex',
    extensions: [
      'tex',
      'sty',
      'cls',
      'clo',
      'bst',
      'bbl',
      'pdf_tex',
      'pdf_t',
      'map',
      'fd',
      'enc',
      'def',
      'mf',
      'pgf',
      'tikz',
      'bbx',
      'cbx',
      'dbx',
      'lbx',
      'lco',
      'ldf',
      'xmpdata',
      'Rnw',
      'rnw',
      'lyx',
      'inc',
      'dtx',
      'hak',
      'eps_tex',
      'brf',
      'ins',
      'hva',
      'Rtex',
      'rtex',
      'pstex',
      'pstex_t',
      'gin',
      'fontspec',
      'pygstyle',
      'pygtex',
      'ps_tex',
      'ltx',
    ],
    load: () => {
      return import('./latex').then(m => m.latex())
    },
  }),
  LanguageDescription.of({
    name: 'bibtex',
    extensions: ['bib'],
    load: () => {
      return import('./bibtex').then(m => m.bibtex())
    },
  }),
  LanguageDescription.of({
    name: 'markdown',
    extensions: ['md', 'markdown'],
    load: () => {
      return import('./markdown').then(m => m.markdown())
    },
  }),
]
