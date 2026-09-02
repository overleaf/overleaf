import { text } from 'node:stream/consumers'
import { BlobStoreBase } from 'overleaf-editor-core'
import HistoryManager from './HistoryManager.mjs'

/**
 * The blob store of a project's history, as overleaf-editor-core wants it.
 *
 * Reading covers what File#load asks for, so a snapshot's files can be loaded
 * eagerly here -- needed for the ones with pending edit operations, whose content
 * is not in a single blob.
 */
class HistoryBlobStore extends BlobStoreBase {
  /**
   * @param {string} historyId
   */
  constructor(historyId) {
    super()
    this.historyId = historyId
  }

  /**
   * @param {string} hash
   * @return {Promise<string>}
   */
  async fetchString(hash) {
    const { stream } = await HistoryManager.promises.requestBlob(
      this.historyId,
      hash
    )
    return await text(stream)
  }
}

export default HistoryBlobStore
