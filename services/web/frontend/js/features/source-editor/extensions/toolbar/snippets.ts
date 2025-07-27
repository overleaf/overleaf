import { environments } from '../../languages/latex/completions/data/environments'
import { prepareSnippetTemplate } from '../../languages/latex/snippets'

export const snippets: { [key: string]: string } = {
  figure: prepareSnippetTemplate(environments.get('figure') as string),
  table: prepareSnippetTemplate(environments.get('table') as string),
  latex_cite: prepareSnippetTemplate('\\cite{${}}'),
  typst_cite: prepareSnippetTemplate('@${}'),
  latex_ref: prepareSnippetTemplate('\\ref{${}}'),
  typst_ref: prepareSnippetTemplate('@${}'),
}
