import AbstractMockApi from './AbstractMockApi.mjs'
import { parseReq, z, getRawReqInput } from '@overleaf/validation-tools'

const deleteProjectSchema = z.object({
  params: z.strictObject({ projectId: z.string() }),
})

const postbackParamsSchema = z.object({
  params: z.strictObject({ id: z.string() }),
})

class MockGitBridgeApi extends AbstractMockApi {
  reset() {
    this.projects = {}
    this.postbacks = {}
  }

  applyRoutes() {
    this.app.delete('/api/projects/:projectId', (req, res) => {
      this.deleteProject(req, res)
    })
    this.app.post('/postback/:id', (req, res) => {
      this.postback(req, res)
    })
  }

  deleteProject(req, res) {
    const { params } = parseReq(req, deleteProjectSchema)
    const projectId = params.projectId
    delete this.projects[projectId]
    res.sendStatus(204)
  }

  // Git bridge accepts a postback to indicate when a operation is complete.
  // Each postback is identified by a unique ID.
  // Allow registering a handler which resolves when a postback is received.
  registerPostback(id) {
    return new Promise((resolve, reject) => {
      this.postbacks[id] = { resolve, reject }
    })
  }

  postback(req, res) {
    const { params } = parseReq(req, postbackParamsSchema)
    const { id } = params
    // case 3: recorded verbatim for later assertion by acceptance tests
    const postbackData = getRawReqInput(req).body
    if (this.postbacks[id]) {
      this.postbacks[id].resolve(postbackData)
    }
    res.sendStatus(204)
  }
}

export default MockGitBridgeApi
