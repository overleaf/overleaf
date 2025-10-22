import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'

export default {
  indexAll(req, res, next) {
    const projectId = req.params.Project_id
    const { shouldBroadcast, clientId } = req.body
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
