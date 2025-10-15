const fs = require('fs')
const path = require('path')
const modulePath = path.resolve(
  __dirname,
  '../scripts/lezer-latex/generate.mjs'
)

try {
  fs.accessSync(modulePath, fs.constants.W_OK)
  const { compile, grammars } = require(modulePath).default
  const PLUGIN_NAME = 'lezer-grammar-compiler'
  class LezerGrammarCompilerPlugin {
    apply(compiler) {
      for (const grammar of grammars) {
        compiler.hooks.make.tap(PLUGIN_NAME, compilation => {
          // Add the grammar file to the file paths watched by webpack
          compilation.fileDependencies.add(grammar.grammarPath)
        })
        compiler.hooks.beforeCompile.tapAsync(
          PLUGIN_NAME,
          (_compilation, callback) => {
            // Check timestamps on grammar and parser files, and re-compile if needed.
            // (Note: the compiled parser file is watched by webpack, and so will trigger
            //  a second compilation immediately after. This seems harmless.)
            if (
              !fs.existsSync(grammar.parserOutputPath) ||
              !fs.existsSync(grammar.termsOutputPath)
            ) {
              console.log('Parser does not exist, compiling')
              compile(grammar)
              return callback()
            }
            fs.stat(grammar.grammarPath, (err, grammarStat) => {
              if (err) {
                return callback(err)
              }
              fs.stat(grammar.parserOutputPath, (err, parserStat) => {
                if (err) {
                  return callback(err)
                }
                callback()
                if (grammarStat.mtime > parserStat.mtime) {
                  console.log(
                    'Grammar file newer than parser file, re-compiling'
                  )
                  compile(grammar)
                }
              })
            })
          }
        )
      }
    }
  }
  module.exports = { LezerGrammarCompilerPlugin }
} catch {
  class NoOpPlugin {
    apply() {
      console.log('lezer-latex module not present, skipping compile')
    }
  }
  module.exports = { LezerGrammarCompilerPlugin: NoOpPlugin }
}
