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
  apply(webRouter) {
    webRouter.get('/', HomeController.index)
    webRouter.get('/home', HomeController.home)

    webRouter.get(
      '/planned_maintenance',
      HomeController.externalPage('planned_maintenance', 'Planned Maintenance')
    )

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
  },
}
