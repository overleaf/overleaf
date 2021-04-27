const logger = require('logger-sharelatex')
const pug = require('pug')
const globby = require('globby')
const Settings = require('settings-sharelatex')
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
    let startTime = Date.now()
    let success = 0
    let failures = 0
    viewList.forEach(view => {
      let filename = path.resolve(view + '.pug') // express views are cached using the absolute path
      try {
        pug.compileFile(filename, {
          cache: true,
          compileDebug: Settings.debugPugTemplates,
        })
        logger.log({ filename }, 'compiled')
        success++
      } catch (err) {
        logger.error({ filename, err: err.message }, 'error compiling')
        failures++
      }
    })
    logger.log(
      { timeTaken: Date.now() - startTime, failures, success },
      'compiled templates'
    )
  },
}
