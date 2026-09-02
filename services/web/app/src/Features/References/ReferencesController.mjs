import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

const indexAllSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    shouldBroadcast: z.boolean().optional(),
    clientId: z.string().optional(),
  }),
})

export default {
  indexAll(req, res, next) {
    const { params, body } = parseReq(req, indexAllSchema, {
      logOnly: true,
    })
    const projectId = params.Project_id
    const { shouldBroadcast, clientId } = body
    // We've migrated to client side indexing, so we only use the message for
    // broadcasting that the clients need to re-index.
    if (shouldBroadcast) {
      EditorRealTimeController.emitToRoom(
        projectId,
        'references:keys:updated',
        [],
        true,
        clientId
      )
    }
    res.json({ projectId, keys: [] })
  },
}
