import Features from '../../infrastructure/Features.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import Path from 'node:path'
import fs from 'node:fs'
import ErrorController from '../Errors/ErrorController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'

const __dirname = new URL('.', import.meta.url).pathname

const homepageExists = fs.existsSync(
  Path.join(__dirname, '/../../../views/external/home/index.pug')
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
    const acceptLanguage = req.headers['accept-language'] || 'en' // returns in format => en-GB,en-US;q=0.9,en;q=0.8
    const language = acceptLanguage.split(',')[0].split(';')[0].trim() // filters the first language
    const host = req.headers.host
    const domain = host?.split('.')[0]

    AnalyticsManager.recordEventForSession(req.session, 'home-page-view', {
      page: req.path,
      language,
      domain,
    })

    const hotjarAssignment = await SplitTestHandler.promises.getAssignment(
      req,
      res,
      'hotjar-marketing'
    )

    res.render('external/home/index', {
      shouldLoadHotjar: hotjarAssignment?.variant === 'enabled',
    })
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

export default {
  index: expressify(index),
  home: expressify(home),
  externalPage,
}
