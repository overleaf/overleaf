import _ from 'lodash'
/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import CryptoJSSHA1 from 'crypto-js/sha1'
let ReferencesManager

export default ReferencesManager = class ReferencesManager {
  constructor(ide, $scope) {
    this.ide = ide
    this.$scope = $scope
    this.$scope.$root._references = this.state = { keys: [] }
    this.existingIndexHash = {}

    this.$scope.$on('document:closed', (e, doc) => {
      let entity
      if (doc.doc_id) {
        entity = this.ide.fileTreeManager.findEntityById(doc.doc_id)
      }
      if (
        __guard__(entity != null ? entity.name : undefined, x =>
          x.match(/.*\.bib$/)
        )
      ) {
        return this.indexReferencesIfDocModified(doc, true)
      }
    })

    this.$scope.$on('references:should-reindex', (e, data) => {
      return this.indexAllReferences(true)
    })

    // When we join the project:
    //   index all references files
    //   and don't broadcast to all clients
    this.inited = false
    this.$scope.$on('project:joined', e => {
      // We only need to grab the references when the editor first loads,
      // not on every reconnect
      if (!this.inited) {
        this.inited = true
        this.ide.socket.on('references:keys:updated', (keys, allDocs) =>
          this._storeReferencesKeys(keys, allDocs)
        )
        this.indexAllReferences(false)
      }
    })
  }

  _storeReferencesKeys(newKeys, replaceExistingKeys) {
    const oldKeys = this.$scope.$root._references.keys
    const keys = replaceExistingKeys ? newKeys : _.union(oldKeys, newKeys)
    window.dispatchEvent(
      new CustomEvent('project:references', {
        detail: keys,
      })
    )
    return (this.$scope.$root._references.keys = keys)
  }

  indexReferencesIfDocModified(doc, shouldBroadcast) {
    // avoid reindexing references if the bib file has not changed since the
    // last time they were indexed
    const docId = doc.doc_id
    const snapshot = doc._doc.snapshot
    const now = Date.now()
    const sha1 = CryptoJSSHA1(
      'blob ' + snapshot.length + '\x00' + snapshot
    ).toString()
    const CACHE_LIFETIME = 6 * 3600 * 1000 // allow reindexing every 6 hours
    const cacheEntry = this.existingIndexHash[docId]
    const isCached =
      cacheEntry &&
      cacheEntry.timestamp > now - CACHE_LIFETIME &&
      cacheEntry.hash === sha1
    if (!isCached) {
      this.indexAllReferences(shouldBroadcast)
      this.existingIndexHash[docId] = { hash: sha1, timestamp: now }
    }
  }

  indexAllReferences(shouldBroadcast) {
    const opts = {
      shouldBroadcast,
      _csrf: window.csrfToken,
    }
    return this.ide.$http
      .post(`/project/${this.$scope.project_id}/references/indexAll`, opts)
      .then(response => {
        return this._storeReferencesKeys(response.data.keys, true)
      })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
