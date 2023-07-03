const { buildParserFile } = require('@lezer/generator')
const { writeFileSync, readFileSync } = require('fs')
const path = require('path')

const grammars = [
  {
    grammarPath: path.resolve(
      __dirname,
      '../../frontend/js/features/source-editor/lezer-latex/latex.grammar'
    ),
    parserOutputPath: path.resolve(
      __dirname,
      '../../frontend/js/features/source-editor/lezer-latex/latex.mjs'
    ),
    termsOutputPath: path.resolve(
      __dirname,
      '../../frontend/js/features/source-editor/lezer-latex/latex.terms.mjs'
    ),
  },
  {
    grammarPath: path.resolve(
      __dirname,
      '../../frontend/js/features/source-editor/lezer-bibtex/bibtex.grammar'
    ),
    parserOutputPath: path.resolve(
      __dirname,
      '../../frontend/js/features/source-editor/lezer-bibtex/bibtex.mjs'
    ),
    termsOutputPath: path.resolve(
      __dirname,
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

module.exports = { compile, grammars }

if (require.main === module) {
  try {
    grammars.forEach(compile)
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
