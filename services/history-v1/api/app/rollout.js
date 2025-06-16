const crypto = require('node:crypto')

class Rollout {
  constructor(config) {
    // The history buffer level is used to determine whether to queue changes
    // in Redis or persist them directly to the chunk store.
    // If defaults to 0 (no queuing) if not set.
    this.historyBufferLevel = config.has('historyBufferLevel')
      ? parseInt(config.get('historyBufferLevel'), 10)
      : 0
    // The forcePersistBuffer flag will ensure the buffer is fully persisted before
    // any persist operation. Set this to true if you want to make the persisted-version
    // in Redis match the endVersion of the latest chunk. This should be set to true
    // when downgrading from a history buffer level that queues changes in Redis
    // without persisting them immediately.
    this.forcePersistBuffer = config.has('forcePersistBuffer')
      ? config.get('forcePersistBuffer') === 'true'
      : false

    // Support gradual rollout of the next history buffer level
    // with a percentage of projects using it.
    this.nextHistoryBufferLevel = config.has('nextHistoryBufferLevel')
      ? parseInt(config.get('nextHistoryBufferLevel'), 10)
      : null
    this.nextHistoryBufferLevelRolloutPercentage = config.has(
      'nextHistoryBufferLevelRolloutPercentage'
    )
      ? parseInt(config.get('nextHistoryBufferLevelRolloutPercentage'), 10)
      : 0
  }

  report(logger) {
    logger.info(
      {
        historyBufferLevel: this.historyBufferLevel,
        forcePersistBuffer: this.forcePersistBuffer,
        nextHistoryBufferLevel: this.nextHistoryBufferLevel,
        nextHistoryBufferLevelRolloutPercentage:
          this.nextHistoryBufferLevelRolloutPercentage,
      },
      this.historyBufferLevel > 0 || this.forcePersistBuffer
        ? 'using history buffer'
        : 'history buffer disabled'
    )
  }

  /**
   * Get the history buffer level for a project.
   * @param {string} projectId
   * @returns {Object} - An object containing the history buffer level and force persist buffer flag.
   * @property {number} historyBufferLevel - The history buffer level to use for processing changes.
   * @property {boolean} forcePersistBuffer - If true, forces the buffer to be persisted before any operation.
   */
  getHistoryBufferLevelOptions(projectId) {
    if (
      this.nextHistoryBufferLevel > this.historyBufferLevel &&
      this.nextHistoryBufferLevelRolloutPercentage > 0
    ) {
      const hash = crypto.createHash('sha1').update(projectId).digest('hex')
      const percentage = parseInt(hash.slice(0, 8), 16) % 100
      // If the project is in the rollout percentage, we use the next history buffer level.
      if (percentage < this.nextHistoryBufferLevelRolloutPercentage) {
        return {
          historyBufferLevel: this.nextHistoryBufferLevel,
          forcePersistBuffer: this.forcePersistBuffer,
        }
      }
    }
    return {
      historyBufferLevel: this.historyBufferLevel,
      forcePersistBuffer: this.forcePersistBuffer,
    }
  }
}

module.exports = Rollout
