import Features from '../../infrastructure/Features.js'
import AnalyticsManager from '../Analytics/AnalyticsManager.js'
import Path from 'node:path'
import fs from 'node:fs'
import ErrorController from '../Errors/ErrorController.js'
import SessionManager from '../Authentication/SessionManager.js'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'

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
    AnalyticsManager.recordEventForSession(req.session, 'home-page-view', {
      page: req.path,
    })

    res.render('external/home/index')
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
