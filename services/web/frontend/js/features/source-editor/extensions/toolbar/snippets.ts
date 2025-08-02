import { environments } from '../../languages/latex/completions/data/environments'
import { prepareSnippetTemplate } from '../../languages/latex/snippets'

export const snippets: { [key: string]: string } = {
  latex_figure: prepareSnippetTemplate(environments.get('figure') as string),
  typst_figure: prepareSnippetTemplate(`#figure(
\timage("{$1}", width: 50%),
\tcaption: [\${2:Caption}]
) <\${3:fig:enter-label}>`),
  table: prepareSnippetTemplate(environments.get('table') as string),
  latex_cite: prepareSnippetTemplate('\\cite{${}}'),
  typst_cite: prepareSnippetTemplate('@${}'),
  latex_ref: prepareSnippetTemplate('\\ref{${}}'),
  typst_ref: prepareSnippetTemplate('@${}'),
}
