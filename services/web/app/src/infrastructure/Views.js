const logger = require('@overleaf/logger')
const pug = require('pug')
const globby = require('globby')
const Settings = require('@overleaf/settings')
const path = require('path')

// Generate list of view names from app/views

const viewList = globby
  .sync('app/views/**/*.pug', {
    onlyFiles: true,
    concurrency: 1,
    ignore: '**/_*.pug',
  })
  .concat(
    globby.sync('modules/*/app/views/**/*.pug', {
      onlyFiles: true,
      concurrency: 1,
      ignore: '**/_*.pug',
    })
  )
  .map(x => {
    return x.replace(/\.pug$/, '') // strip trailing .pug extension
  })
  .filter(x => {
    return !/^_/.test(x)
  })

module.exports = {
  precompileViews(app) {
    const startTime = Date.now()
    let success = 0
    let failures = 0
    viewList.forEach(view => {
      const filename = path.resolve(view + '.pug') // express views are cached using the absolute path
      try {
        pug.compileFile(filename, {
          cache: true,
          compileDebug: Settings.debugPugTemplates,
        })
        logger.debug({ filename }, 'compiled')
        success++
      } catch (err) {
        logger.error({ filename, err: err.message }, 'error compiling')
        failures++
      }
    })
    logger.debug(
      { timeTaken: Date.now() - startTime, failures, success },
      'compiled templates'
    )
  },
}
