// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DiffManager
const UpdatesManager = require('./UpdatesManager')
const DocumentUpdaterManager = require('./DocumentUpdaterManager')
const DiffGenerator = require('./DiffGenerator')
const logger = require('@overleaf/logger')

module.exports = DiffManager = {
  getLatestDocAndUpdates(projectId, docId, fromVersion, callback) {
    // Get updates last, since then they must be ahead and it
    // might be possible to rewind to the same version as the doc.
    if (callback == null) {
      callback = function () {}
    }
    return DocumentUpdaterManager.getDocument(
      projectId,
      docId,
      function (error, content, version) {
        if (error != null) {
          return callback(error)
        }
        if (fromVersion == null) {
          // If we haven't been given a version, just return lastest doc and no updates
          return callback(null, content, version, [])
        }
        return UpdatesManager.getDocUpdatesWithUserInfo(
          projectId,
          docId,
          { from: fromVersion },
          function (error, updates) {
            if (error != null) {
              return callback(error)
            }
            return callback(null, content, version, updates)
          }
        )
      }
    )
  },

  getDiff(projectId, docId, fromVersion, toVersion, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return DiffManager.getDocumentBeforeVersion(
      projectId,
      docId,
      fromVersion,
      function (error, startingContent, updates) {
        let diff
        if (error != null) {
          if (error.message === 'broken-history') {
            return callback(null, 'history unavailable')
          } else {
            return callback(error)
          }
        }

        const updatesToApply = []
        for (const update of Array.from(updates.slice().reverse())) {
          if (update.v <= toVersion) {
            updatesToApply.push(update)
          }
        }

        try {
          diff = DiffGenerator.buildDiff(startingContent, updatesToApply)
        } catch (e) {
          return callback(e)
        }

        return callback(null, diff)
      }
    )
  },

  getDocumentBeforeVersion(projectId, docId, version, _callback) {
    // Whichever order we get the latest document and the latest updates,
    // there is potential for updates to be applied between them so that
    // they do not return the same 'latest' versions.
    // If this happens, we just retry and hopefully get them at the compatible
    // versions.
    let retry
    if (_callback == null) {
      _callback = function () {}
    }
    let retries = 3
    const callback = function (error, ...args) {
      if (error != null) {
        if (error.retry && retries > 0) {
          logger.warn(
            { error, projectId, docId, version, retries },
            'retrying getDocumentBeforeVersion'
          )
          return retry()
        } else {
          return _callback(error)
        }
      } else {
        return _callback(null, ...Array.from(args))
      }
    }

    return (retry = function () {
      retries--
      return DiffManager._tryGetDocumentBeforeVersion(
        projectId,
        docId,
        version,
        callback
      )
    })()
  },

  _tryGetDocumentBeforeVersion(projectId, docId, version, callback) {
    if (callback == null) {
      callback = function () {}
    }
    logger.debug(
      { projectId, docId, version },
      'getting document before version'
    )
    return DiffManager.getLatestDocAndUpdates(
      projectId,
      docId,
      version,
      function (error, content, version, updates) {
        let startingContent
        if (error != null) {
          return callback(error)
        }

        // bail out if we hit a broken update
        for (const u of Array.from(updates)) {
          if (u.broken) {
            return callback(new Error('broken-history'))
          }
        }

        // discard any updates which are ahead of this document version
        while ((updates[0] != null ? updates[0].v : undefined) >= version) {
          updates.shift()
        }

        const lastUpdate = updates[0]
        if (lastUpdate != null && lastUpdate.v !== version - 1) {
          error = new Error(
            `latest update version, ${lastUpdate.v}, does not match doc version, ${version}`
          )
          error.retry = true
          return callback(error)
        }

        logger.debug(
          {
            docVersion: version,
            lastUpdateVersion: lastUpdate != null ? lastUpdate.v : undefined,
            updateCount: updates.length,
          },
          'rewinding updates'
        )

        const tryUpdates = updates.slice().reverse()

        try {
          startingContent = DiffGenerator.rewindUpdates(content, tryUpdates)
          // tryUpdates is reversed, and any unapplied ops are marked as broken
        } catch (e) {
          return callback(e)
        }

        return callback(null, startingContent, tryUpdates)
      }
    )
  },
}
