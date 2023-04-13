const { buildParserFile } = require('@lezer/generator')
const { writeFileSync, readFileSync } = require('fs')
const path = require('path')

const options = {
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
}

function compile() {
  const { grammarPath, termsOutputPath, parserOutputPath } = options
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

module.exports = { compile, options }

if (require.main === module) {
  try {
    compile()
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
