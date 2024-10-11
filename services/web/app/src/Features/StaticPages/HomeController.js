const Features = require('../../infrastructure/Features')
const AnalyticsManager = require('../Analytics/AnalyticsManager')

const Path = require('path')
const fs = require('fs')

const ErrorController = require('../Errors/ErrorController')
const SessionManager = require('../Authentication/SessionManager')

const { expressify } = require('@overleaf/promise-utils')
const logger = require('@overleaf/logger')
const SplitTestHandler = require('../SplitTests/SplitTestHandler')

const homepageExists = fs.existsSync(
  Path.join(
    __dirname,
    '/../../../views/external/home/website-redesign/index.pug'
  )
)

async function index(req, res) {
  if (SessionManager.isUserLoggedIn(req.session)) {
    if (req.query.scribtex_path != null) {
      res.redirect(`/project?scribtex_path=${req.query.scribtex_path}`)
    } else {
      res.redirect('/project')
    }
  } else {
    await home(req, res)
  }
}

async function home(req, res) {
  if (Features.hasFeature('homepage') && homepageExists) {
    AnalyticsManager.recordEventForSession(req.session, 'home-page-view', {
      page: req.path,
    })

    try {
      await SplitTestHandler.promises.getAssignment(req, res, 'hotjar')
    } catch {
      // do nothing
    }

    res.render('external/home/website-redesign/index')
  } else {
    res.redirect('/login')
  }
}

function externalPage(page, title) {
  const middleware = async function (req, res, next) {
    const path = Path.join(__dirname, `/../../../views/external/${page}.pug`)
    try {
      const stats = await fs.promises.stat(path)
      if (!stats.isFile()) {
        logger.error({ stats, path }, 'Error serving external page')
        ErrorController.notFound(req, res, next)
      } else {
        res.render(`external/${page}.pug`, { title })
      }
    } catch (error) {
      logger.error({ path }, 'Error serving external page: file not found')
      ErrorController.notFound(req, res, next)
    }
  }
  return expressify(middleware)
}

module.exports = {
  index: expressify(index),
  home: expressify(home),
  externalPage,
}
