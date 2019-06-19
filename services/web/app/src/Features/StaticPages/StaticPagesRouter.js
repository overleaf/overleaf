/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const HomeController = require('./HomeController')
const UniversityController = require('./UniversityController')

module.exports = {
  apply(webRouter, apiRouter) {
    webRouter.get('/', HomeController.index)
    webRouter.get('/home', HomeController.home)

    webRouter.get(
      '/tos',
      HomeController.externalPage('tos', 'Terms of Service')
    )
    webRouter.get('/about', HomeController.externalPage('about', 'About Us'))

    webRouter.get(
      '/security',
      HomeController.externalPage('security', 'Security')
    )
    webRouter.get(
      '/privacy_policy',
      HomeController.externalPage('privacy', 'Privacy Policy')
    )
    webRouter.get(
      '/planned_maintenance',
      HomeController.externalPage('planned_maintenance', 'Planned Maintenance')
    )
    webRouter.get(
      '/style',
      HomeController.externalPage('style_guide', 'Style Guide')
    )
    webRouter.get('/jobs', HomeController.externalPage('jobs', 'Jobs'))

    webRouter.get(
      '/track-changes-and-comments-in-latex',
      HomeController.externalPage('review-features-page', 'Review features')
    )

    webRouter.get(
      '/dropbox',
      HomeController.externalPage('dropbox', 'Dropbox and ShareLaTeX')
    )

    webRouter.get('/university', UniversityController.getIndexPage)
    return webRouter.get('/university/*', UniversityController.getPage)
  }
}
