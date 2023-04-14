import { environments } from '../../languages/latex/completions/data/environments'
import { prepareSnippetTemplate } from '../../languages/latex/snippets'

export const snippets = {
  figure: prepareSnippetTemplate(environments.get('figure') as string),
  table: prepareSnippetTemplate(environments.get('table') as string),
  cite: prepareSnippetTemplate('\\cite{${}}'),
  ref: prepareSnippetTemplate('\\ref{${}}'),
}
