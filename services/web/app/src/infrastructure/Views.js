const logger = require('@overleaf/logger')
const pug = require('pug')
const globby = require('globby')
const Settings = require('@overleaf/settings')
const fs = require('fs')
const Path = require('path')

// Generate list of view names from app/views
function buildViewList() {
  return globby
    .sync('app/views/**/*.pug', {
      onlyFiles: true,
      concurrency: 1,
      ignore: [
        // Ignore includes
        '**/_*.pug',
        '**/_*/**',
        // Ignore shared layout files
        'app/views/layout*',
        'app/views/layout/*',
      ],
    })
    .concat(
      globby.sync('modules/*/app/views/**/*.pug', {
        onlyFiles: true,
        concurrency: 1,
        // Ignore includes
        ignore: ['**/_*.pug', '**/_*/**'],
      })
    )
    .concat(Object.values(Settings.viewIncludes).flat())
    .map(x => Path.resolve(x))
}

const PUG_COMPILE_ARGUMENTS = {
  doctype: 'html',
  cache: true,
  compileDebug: Settings.debugPugTemplates,
  inlineRuntimeFunctions: false,
  module: true,
}

function precompileViewsAndCacheToDisk() {
  const startTime = Date.now()
  let success = 0
  let precompiled = 0
  for (const filename of buildViewList()) {
    const precompiledFilename = filename.replace(/\.pug$/, '.js')
    try {
      const src = pug.compileFileClient(filename, PUG_COMPILE_ARGUMENTS)
      try {
        if (fs.readFileSync(precompiledFilename, 'utf-8') === src) {
          precompiled++
          continue
        }
      } catch {}
      fs.writeFileSync(precompiledFilename, src, {
        encoding: 'utf-8',
        mode: 0o644,
      })
      success++
    } catch (err) {
      logger.err({ err, filename }, 'failed to precompile pug template')
      throw err
    }
  }
  logger.info(
    { timeTaken: Date.now() - startTime, success, precompiled },
    'compiled pug templates'
  )
}

module.exports = {
  compileViewIncludes(app) {
    const viewIncludes = {}
    for (const [view, paths] of Object.entries(Settings.viewIncludes)) {
      viewIncludes[view] = []
      for (const filePath of paths) {
        viewIncludes[view].push(
          pug.compileFile(filePath, {
            ...PUG_COMPILE_ARGUMENTS,
            cache: app.enabled('view cache'),
          })
        )
      }
    }
    return viewIncludes
  },

  precompileViews(app) {
    const startTime = Date.now()
    let success = 0
    let precompiled = 0
    let failures = 0
    for (const filename of buildViewList()) {
      const precompiledFilename = filename.replace(/\.pug$/, '.js')
      if (fs.existsSync(precompiledFilename)) {
        logger.debug({ filename }, 'loading precompiled pug template')
        try {
          pug.cache[filename] = require(precompiledFilename)
          precompiled++
          continue
        } catch (err) {
          logger.error(
            { filename, err },
            'error loading precompiled pug template'
          )
          failures++
        }
      }
      try {
        logger.warn({ filename }, 'compiling pug template at boot time')
        pug.compileFile(filename, PUG_COMPILE_ARGUMENTS)
        success++
      } catch (err) {
        logger.error({ filename, err }, 'error compiling pug template')
        failures++
      }
    }
    logger.debug(
      { timeTaken: Date.now() - startTime, failures, success, precompiled },
      'compiled pug templates'
    )
  },
}

if (require.main === module) {
  precompileViewsAndCacheToDisk()
  process.exit(0)
}
