/* eslint-disable
    no-return-assign,
    no-undef,
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
define(['base'], App =>
  App.factory('metadata', function($http, ide) {
    const debouncer = {} // DocId => Timeout

    const state = { documents: {} }

    const metadata = { state }

    metadata.onBroadcastDocMeta = function(data) {
      if (data.docId != null && data.meta != null) {
        return (state.documents[data.docId] = data.meta)
      }
    }

    metadata.onEntityDeleted = function(e, entity) {
      if (entity.type === 'doc') {
        return delete state.documents[entity.id]
      }
    }

    metadata.onFileUploadComplete = function(e, upload) {
      if (upload.entity_type === 'doc') {
        return metadata.loadDocMetaFromServer(upload.entity_id)
      }
    }

    metadata.getAllLabels = () =>
      _.flattenDeep(
        (() => {
          const result = []
          for (let docId in state.documents) {
            const meta = state.documents[docId]
            result.push(meta.labels)
          }
          return result
        })()
      )

    metadata.getAllPackages = function() {
      const packageCommandMapping = {}
      for (let _docId in state.documents) {
        const meta = state.documents[_docId]
        for (let packageName in meta.packages) {
          const commandSnippets = meta.packages[packageName]
          packageCommandMapping[packageName] = commandSnippets
        }
      }
      return packageCommandMapping
    }

    metadata.loadProjectMetaFromServer = () =>
      $http
        .get(`/project/${window.project_id}/metadata`)
        .then(function(response) {
          const { data } = response
          if (data.projectMeta) {
            return (() => {
              const result = []
              for (let docId in data.projectMeta) {
                const docMeta = data.projectMeta[docId]
                result.push((state.documents[docId] = docMeta))
              }
              return result
            })()
          }
        })

    metadata.loadDocMetaFromServer = docId =>
      $http.post(`/project/${window.project_id}/doc/${docId}/metadata`, {
        _csrf: window.csrfToken
      })

    metadata.scheduleLoadDocMetaFromServer = function(docId) {
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

    return metadata
  }))
