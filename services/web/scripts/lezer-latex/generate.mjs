/* eslint-disable @overleaf/require-script-runner */
// This script doesn't work with ScriptRunner because it is run during the build process.
import { buildParserFile } from '@lezer/generator'
import { writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'

const grammars = [
  {
    grammarPath: path.resolve(
      import.meta.dirname,
      '../../frontend/js/features/source-editor/lezer-latex/latex.grammar'
    ),
    parserOutputPath: path.resolve(
      import.meta.dirname,
      '../../frontend/js/features/source-editor/lezer-latex/latex.mjs'
    ),
    termsOutputPath: path.resolve(
      import.meta.dirname,
      '../../frontend/js/features/source-editor/lezer-latex/latex.terms.mjs'
    ),
  },
  {
    grammarPath: path.resolve(
      import.meta.dirname,
      '../../frontend/js/features/source-editor/lezer-bibtex/bibtex.grammar'
    ),
    parserOutputPath: path.resolve(
      import.meta.dirname,
      '../../frontend/js/features/source-editor/lezer-bibtex/bibtex.mjs'
    ),
    termsOutputPath: path.resolve(
      import.meta.dirname,
      '../../frontend/js/features/source-editor/lezer-bibtex/bibtex.terms.mjs'
    ),
  },
]

function compile(grammar) {
  const { grammarPath, termsOutputPath, parserOutputPath } = grammar
  const moduleStyle = 'es'
  console.info(`Compiling ${grammarPath}`)

  const grammarText = readFileSync(grammarPath, 'utf8')
  console.info(`Loaded grammar from ${grammarPath}`)

  const { parser, terms } = buildParserFile(grammarText, {
    fileName: grammarPath,
    moduleStyle,
  })
  console.info(`Built parser`)

  writeFileSync(parserOutputPath, parser)
  console.info(`Wrote parser to ${parserOutputPath}`)

  writeFileSync(termsOutputPath, terms)
  console.info(`Wrote terms to ${termsOutputPath}`)

  console.info('Done!')
}

export default { compile, grammars }

if (
  import.meta.url === process.argv[1] ||
  import.meta.url === `file://${process.argv[1]}`
) {
  try {
    grammars.forEach(compile)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
