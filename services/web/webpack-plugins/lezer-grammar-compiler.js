const fs = require('fs')
const path = require('path')
const modulePath = path.resolve(__dirname, '../scripts/lezer-latex/generate.js')

try {
  fs.accessSync(modulePath, fs.constants.W_OK)
  const { compile, options } = require(modulePath)
  const PLUGIN_NAME = 'lezer-grammar-compiler'
  class LezerGrammarCompilerPlugin {
    apply(compiler) {
      compiler.hooks.make.tap(PLUGIN_NAME, compilation => {
        // Add the grammar file to the file paths watched by webpack
        compilation.fileDependencies.add(options.grammarPath)
      })
      compiler.hooks.beforeCompile.tapAsync(
        PLUGIN_NAME,
        (_compilation, callback) => {
          // Check timestamps on grammar and parser files, and re-compile if needed.
          // (Note: the compiled parser file is watched by webpack, and so will trigger
          //  a second compilation immediately after. This seems harmless.)
          if (
            !fs.existsSync(options.parserOutputPath) ||
            !fs.existsSync(options.termsOutputPath)
          ) {
            console.log('Parser does not exist, compiling')
            compile()
            return callback()
          }
          fs.stat(options.grammarPath, (err, grammarStat) => {
            if (err) {
              return callback(err)
            }
            fs.stat(options.parserOutputPath, (err, parserStat) => {
              if (err) {
                return callback(err)
              }
              callback()
              if (grammarStat.mtime > parserStat.mtime) {
                console.log('Grammar file newer than parser file, re-compiling')
                compile()
              }
            })
          })
        }
      )
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
