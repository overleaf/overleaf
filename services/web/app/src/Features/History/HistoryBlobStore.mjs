import { text } from 'node:stream/consumers'
import HistoryManager from './HistoryManager.mjs'

/**
 * The blob store of a project's history, as overleaf-editor-core wants it.
 *
 * Reading covers what File#load asks for, so a snapshot's files can be loaded
 * eagerly here -- needed for the ones with pending edit operations, whose content
 * is not in a single blob.
 */
class HistoryBlobStore {
  /**
   * @param {string} historyId
   */
  constructor(historyId) {
    this.historyId = historyId
  }

  /**
   * @param {string} hash
   * @return {Promise<string>}
   */
  async getString(hash) {
    const { stream } = await HistoryManager.promises.requestBlob(
      this.historyId,
      hash
    )
    return await text(stream)
  }

  /**
   * @param {string} hash
   * @return {Promise<object>}
   */
  async getObject(hash) {
    return JSON.parse(await this.getString(hash))
  }
}

export default HistoryBlobStore
