/* eslint-disable
    handle-callback-err,
    max-len,
    no-path-concat,
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
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const _ = require('underscore')
const Features = require('../../infrastructure/Features')

const Path = require('path')
const fs = require('fs')

const ErrorController = require('../Errors/ErrorController')
const AuthenticationController = require('../Authentication/AuthenticationController')

const slHomepageExists = fs.existsSync(
  Path.resolve(__dirname + '/../../../views/external/home/sl.pug')
)
const v2HomepageExists = fs.existsSync(
  Path.resolve(__dirname + '/../../../views/external/home/v2.pug')
)

module.exports = HomeController = {
  index(req, res) {
    if (AuthenticationController.isUserLoggedIn(req)) {
      if (req.query.scribtex_path != null) {
        return res.redirect(`/project?scribtex_path=${req.query.scribtex_path}`)
      } else {
        return res.redirect('/project')
      }
    } else {
      return HomeController.home(req, res)
    }
  },

  home(req, res, next) {
    if (
      Features.hasFeature('homepage') &&
      !Settings.overleaf &&
      slHomepageExists
    ) {
      return res.render('external/home/sl')
    } else if (
      Features.hasFeature('homepage') &&
      Settings.overleaf &&
      v2HomepageExists
    ) {
      return res.render('external/home/v2')
    } else {
      return res.redirect('/login')
    }
  },

  externalPage(page, title) {
    return function(req, res, next) {
      if (next == null) {
        next = function(error) {}
      }
      const path = Path.resolve(
        __dirname + `/../../../views/external/${page}.pug`
      )
      return fs.exists(path, function(exists) {
        // No error in this callback - old method in Node.js!
        if (exists) {
          return res.render(`external/${page}.pug`, { title })
        } else {
          return ErrorController.notFound(req, res, next)
        }
      })
    }
  }
}
