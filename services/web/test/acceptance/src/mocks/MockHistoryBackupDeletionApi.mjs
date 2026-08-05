import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z, zz } from '@overleaf/validation-tools'

const deleteProjectSchema = z.object({
  params: z.strictObject({ project_id: zz.objectId() }),
})

class MockHistoryBackupDeletionApi extends AbstractMockApi {
  reset() {
    this.projects = {}
  }

  prepareProject(projectId, status) {
    this.projects[projectId.toString()] = status
  }

  deleteProject(req, res) {
    const { params } = parseReq(req, deleteProjectSchema)
    const projectId = params.project_id
    const status = this.projects[projectId]
    if (status === 422) {
      return res.sendStatus(422)
    }
    delete this.projects[projectId]
    res.sendStatus(204)
  }

  applyRoutes() {
    this.app.delete('/project/:project_id/backup', (req, res) =>
      this.deleteProject(req, res)
    )
  }
}

export default MockHistoryBackupDeletionApi

// type hint for the inherited `instance` method
/**
 * @function instance
 * @memberOf MockHistoryBackupDeletionApi
 * @static
 * @returns {MockHistoryBackupDeletionApi}
 */
