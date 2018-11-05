/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
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
define([], function() {
  let ReferencesManager
  return (ReferencesManager = class ReferencesManager {
    constructor(ide, $scope) {
      this.ide = ide
      this.$scope = $scope
      this.$scope.$root._references = this.state = { keys: [] }

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
          return this.indexReferences([doc.doc_id], true)
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
          return this.indexAllReferences(false)
        }
      })

      setTimeout(
        self =>
          self.ide.socket.on('references:keys:updated', keys =>
            // console.log '>> got keys from socket'
            self._storeReferencesKeys(keys)
          ),

        1000,
        this
      )
    }

    _storeReferencesKeys(newKeys) {
      // console.log '>> storing references keys'
      const oldKeys = this.$scope.$root._references.keys
      return (this.$scope.$root._references.keys = _.union(oldKeys, newKeys))
    }

    indexReferences(docIds, shouldBroadcast) {
      const opts = {
        docIds,
        shouldBroadcast,
        _csrf: window.csrfToken
      }
      return this.ide.$http
        .post(`/project/${this.$scope.project_id}/references/index`, opts)
        .then(response => {
          return this._storeReferencesKeys(response.data.keys)
        })
    }

    indexAllReferences(shouldBroadcast) {
      const opts = {
        shouldBroadcast,
        _csrf: window.csrfToken
      }
      return this.ide.$http
        .post(`/project/${this.$scope.project_id}/references/indexAll`, opts)
        .then(response => {
          return this._storeReferencesKeys(response.data.keys)
        })
    }
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
