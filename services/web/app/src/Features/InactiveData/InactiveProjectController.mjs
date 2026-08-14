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
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

const deactivateOldProjectsSchema = z.object({
  body: z.strictObject({
    numberOfProjectsToArchive: z.coerce.number().int().optional(),
    ageOfProjects: z.coerce.number().int().optional(),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const deactivateOldProjectsFallbackSchema = z.object({
  body: z.object({
    numberOfProjectsToArchive: z.coerce.number().optional(),
    ageOfProjects: z.coerce.number().optional(),
  }),
})

const deactivateProjectSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
})

export default {
  deactivateOldProjects(req, res) {
    const { body } = parseReq(req, deactivateOldProjectsSchema, {
      logOnly: true,
      fallbackSchema: deactivateOldProjectsFallbackSchema,
    })
    const { numberOfProjectsToArchive, ageOfProjects } = body
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
    const { params } = parseReq(req, deactivateProjectSchema, {
      logOnly: true,
    })
    const { project_id: projectId } = params
    return InactiveProjectManager.deactivateProject(projectId, function (err) {
      if (err != null) {
        return res.sendStatus(500)
      } else {
        return res.sendStatus(200)
      }
    })
  },
}
