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

/**
 * @param {string} compiled
 * @return {{duplicates: Array<string>, found: Array<string>}}
 * @private
 */
function _findAllMetaTags(compiled) {
  const inString = /name=(\\?["'`])(ol-.+?)\1/g
  const asExpression = /pug\.attr\("name",\s*(["'`])(ol-.+?)\1/g

  const found = new Set()
  const duplicates = new Set()
  for (const regex of [inString, asExpression]) {
    for (const [, , name] of compiled.matchAll(regex)) {
      if (found.has(name)) duplicates.add(name)
      found.add(name)
    }
  }
  // Special case: Ignore the loop for adding permissions meta tags.
  duplicates.delete('ol-cannot-')
  return { found: Array.from(found), duplicates: Array.from(duplicates) }
}

/**
 * @param {string} filePath
 * @param {string} firstLine
 * @return {boolean}
 * @private
 */
function _expectMetaFor(filePath, firstLine) {
  // no-js pages have no use for ol-meta tags
  if (firstLine.match(/extends .*layout\/layout-no-js/)) return false
  // plain html pages have no use for ol-meta tags
  if (firstLine === 'doctype html') return false
  // xml pages do not use meta tags
  if (firstLine === 'doctype xml') return false
  // view includes should not add meta tags as we cannot trace these easily.
  if (Object.values(Settings.viewIncludes).flat().includes(filePath)) {
    if (
      filePath === Path.resolve('modules/writefull/app/views/_editor_meta.pug')
    ) {
      // Special case: The Writefull module adds meta tags to editor, see inline comment there
      return true
    }
    // default case: no meta tags
    return false
  }
  // default to expect meta tags in top-level templates
  return true
}

/**
 * @param {string} filePath
 * @param {string} compiled
 */
function checkForDuplicateMeta(filePath, compiled) {
  const { found, duplicates } = _findAllMetaTags(compiled)

  if (duplicates.length !== 0) {
    throw new Error(
      `Found duplicate meta tags in ${filePath} (or it's imports): ${Array.from(duplicates)}`
    )
  }
  const firstLine = fs.readFileSync(filePath, 'utf-8').split('\n', 1)[0]
  const expectNoMeta = _expectMetaFor(filePath, firstLine)
  if (found.length === 0 && expectNoMeta) {
    throw new Error(
      `Expected to find meta entries in ${filePath} (or it's imports)`
    )
  }
  if (!expectNoMeta && found.length !== 0) {
    throw new Error(
      `Expected to find no meta entries in plain html or 'viewIncludes'. Found ${Array.from(found)} in ${filePath} (or it's imports)`
    )
  }
}

function precompileViewsAndCacheToDisk() {
  const startTime = Date.now()
  let success = 0
  let precompiled = 0
  for (const filePath of buildViewList()) {
    const precompiledFilename = filePath.replace(/\.pug$/, '.js')
    try {
      const compiled = pug.compileFileClient(filePath, PUG_COMPILE_ARGUMENTS)
      try {
        if (fs.readFileSync(precompiledFilename, 'utf-8') === compiled) {
          precompiled++
          continue
        }
      } catch {}
      checkForDuplicateMeta(filePath, compiled)
      fs.writeFileSync(precompiledFilename, compiled, {
        encoding: 'utf-8',
        mode: 0o644,
      })
      success++
    } catch (err) {
      logger.err({ err, filePath }, 'failed to precompile pug template')
      throw err
    }
  }
  logger.info(
    { timeTaken: Date.now() - startTime, success, precompiled },
    'compiled pug templates'
  )
}

module.exports = {
  // for tests
  PUG_COMPILE_ARGUMENTS,
  _expectMetaFor,
  _findAllMetaTags,

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
    for (const filePath of buildViewList()) {
      const precompiledFilename = filePath.replace(/\.pug$/, '.js')
      if (fs.existsSync(precompiledFilename)) {
        logger.debug({ filePath }, 'loading precompiled pug template')
        try {
          pug.cache[filePath] = require(precompiledFilename)
          precompiled++
          continue
        } catch (err) {
          logger.error(
            { filePath, err },
            'error loading precompiled pug template'
          )
          failures++
        }
      }
      try {
        logger.warn({ filePath }, 'compiling pug template at boot time')
        pug.compileFile(filePath, PUG_COMPILE_ARGUMENTS)
        success++
      } catch (err) {
        logger.error({ filePath, err }, 'error compiling pug template')
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
