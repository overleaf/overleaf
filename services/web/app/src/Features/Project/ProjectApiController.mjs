import ProjectDetailsHandler from './ProjectDetailsHandler.mjs'
import { parseReq, z, zz } from '../../infrastructure/Validation.mjs'

const getProjectDetailsSchema = z.object({
  params: z.strictObject({
    project_id: zz.objectId(),
  }),
})

export default {
  getProjectDetails(req, res, next) {
    const { params } = parseReq(req, getProjectDetailsSchema, {
      logOnly: true,
    })
    const { project_id: projectId } = params
    return ProjectDetailsHandler.getDetails(
      projectId,
      function (err, projDetails) {
        if (err != null) {
          return next(err)
        }
        return res.json(projDetails)
      }
    )
  },
}
