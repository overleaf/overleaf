const logger = require('logger-sharelatex')
const pug = require('pug')
const globby = require('globby')

// Generate list of view names from app/views

const viewList = globby
  .sync('**/*.pug', {
    onlyFiles: true,
    concurrency: 1,
    ignore: '**/_*.pug',
    cwd: 'app/views'
  })
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
      try {
        let filename = app.get('views') + '/' + view + '.pug'
        pug.compileFile(filename, { cache: true })
        logger.log({ view }, 'compiled')
        success++
      } catch (err) {
        logger.error({ view, err: err.message }, 'error compiling')
        failures++
      }
    })
    logger.log(
      { timeTaken: Date.now() - startTime, failures, success },
      'compiled templates'
    )
  }
}
