/* eslint-disable
    node/handle-callback-err,
    max-len,
    no-unused-vars,
    node/no-deprecated-api,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HomeController
const Features = require('../../infrastructure/Features')

const Path = require('path')
const fs = require('fs')

const ErrorController = require('../Errors/ErrorController')
const SessionManager = require('../Authentication/SessionManager')

const SplitTestHandler = require('../SplitTests/SplitTestHandler')
const logger = require('@overleaf/logger')

const homepageExists = fs.existsSync(
  Path.join(__dirname, '/../../../views/external/home/v2.pug')
)

module.exports = HomeController = {
  index(req, res) {
    if (SessionManager.isUserLoggedIn(req.session)) {
      if (req.query.scribtex_path != null) {
        return res.redirect(`/project?scribtex_path=${req.query.scribtex_path}`)
      } else {
        return res.redirect('/project')
      }
    } else {
      return HomeController.home(req, res)
    }
  },

  async home(req, res) {
    if (Features.hasFeature('homepage') && homepageExists) {
      try {
        const highlightSSOAssignment =
          await SplitTestHandler.promises.getAssignment(
            req,
            res,
            'highlight-sso'
          )
        const highlightSSO = highlightSSOAssignment.variant === 'active'
        return res.render('external/home/v2', { highlightSSO })
      } catch (err) {
        logger.error(
          { err },
          "error fetching 'highlight-sso' split test assignment"
        )
        return res.render('external/home/v2', { highlightSSO: false })
      }
    } else {
      return res.redirect('/login')
    }
  },

  externalPage(page, title) {
    return function (req, res, next) {
      if (next == null) {
        next = function () {}
      }
      const path = Path.join(__dirname, `/../../../views/external/${page}.pug`)
      return fs.exists(path, function (exists) {
        // No error in this callback - old method in Node.js!
        if (exists) {
          return res.render(`external/${page}.pug`, { title })
        } else {
          return ErrorController.notFound(req, res, next)
        }
      })
    }
  },
}
