/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import InactiveProjectManager from './InactiveProjectManager.mjs'

export default {
  deactivateOldProjects(req, res) {
    const numberOfProjectsToArchive = parseInt(
      req.body.numberOfProjectsToArchive,
      10
    )
    const { ageOfProjects } = req.body
    return InactiveProjectManager.deactivateOldProjects(
      numberOfProjectsToArchive,
      ageOfProjects,
      function (err, projectsDeactivated) {
        if (err != null) {
          return res.sendStatus(500)
        } else {
          return res.json(projectsDeactivated)
        }
      }
    )
  },

  deactivateProject(req, res) {
    const { project_id: projectId } = req.params
    return InactiveProjectManager.deactivateProject(projectId, function (err) {
      if (err != null) {
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    })
  },
}
