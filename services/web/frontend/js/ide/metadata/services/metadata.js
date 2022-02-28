import _ from 'lodash'
/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../../../base'

export default App.factory('metadata', function ($http, ide) {
  const debouncer = {} // DocId => Timeout

  const state = { documents: {} }

  const metadata = { state }

  metadata.onBroadcastDocMeta = function (data) {
    if (data.docId != null && data.meta != null) {
      state.documents[data.docId] = data.meta
      window.dispatchEvent(
        new CustomEvent('project:metadata', { detail: state.documents })
      )
    }
  }

  metadata.onEntityDeleted = function (e, entity) {
    if (entity.type === 'doc') {
      return delete state.documents[entity.id]
    }
  }

  metadata.getAllLabels = () =>
    _.flattenDeep(
      (() => {
        const result = []
        for (const docId in state.documents) {
          const meta = state.documents[docId]
          result.push(meta.labels)
        }
        return result
      })()
    )

  metadata.getAllPackages = function () {
    const packageCommandMapping = {}
    for (const _docId in state.documents) {
      const meta = state.documents[_docId]
      for (const packageName in meta.packages) {
        const commandSnippets = meta.packages[packageName]
        packageCommandMapping[packageName] = commandSnippets
      }
    }
    return packageCommandMapping
  }

  metadata.loadProjectMetaFromServer = () =>
    $http
      .get(`/project/${window.project_id}/metadata`)
      .then(function (response) {
        const { data } = response
        if (data.projectMeta) {
          return (() => {
            const result = []
            for (const docId in data.projectMeta) {
              const docMeta = data.projectMeta[docId]
              result.push((state.documents[docId] = docMeta))
            }
            window.dispatchEvent(
              new CustomEvent('project:metadata', { detail: state.documents })
            )
            return result
          })()
        }
      })

  metadata.loadDocMetaFromServer = docId =>
    $http
      .post(`/project/${window.project_id}/doc/${docId}/metadata`, {
        // Don't broadcast metadata when there are no other users in the
        // project.
        broadcast: ide.$scope.onlineUsersCount > 0,
        _csrf: window.csrfToken,
      })
      .then(function (response) {
        const { data } = response
        // handle the POST response like a broadcast event when there are no
        // other users in the project.
        metadata.onBroadcastDocMeta(data)
      })

  metadata.scheduleLoadDocMetaFromServer = function (docId) {
    if (ide.$scope.permissionsLevel === 'readOnly') {
      // The POST request is blocked for users without write permission.
      // The user will not be able to consume the meta data for edits anyways.
      return
    }
    // De-bounce loading labels with a timeout
    const existingTimeout = debouncer[docId]

    if (existingTimeout != null) {
      clearTimeout(existingTimeout)
      delete debouncer[docId]
    }

    return (debouncer[docId] = setTimeout(() => {
      metadata.loadDocMetaFromServer(docId)
      return delete debouncer[docId]
    }, 1000))
  }

  window.addEventListener('editor:metadata-outdated', () => {
    metadata.scheduleLoadDocMetaFromServer(ide.$scope.editor.sharejs_doc.doc_id)
  })

  return metadata
})
