/* eslint-disable
    max-len,
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
  App.directive('resolvedCommentsDropdown', _ => ({
    restrict: 'E',
    templateUrl: 'resolvedCommentsDropdownTemplate',
    scope: {
      entries: '=',
      threads: '=',
      resolvedIds: '=',
      docs: '=',
      permissions: '=',
      onOpen: '&',
      onUnresolve: '&',
      onDelete: '&',
      isLoading: '='
    },

    link(scope, element, attrs) {
      let filterResolvedComments
      scope.state = { isOpen: false }

      scope.toggleOpenState = function() {
        scope.state.isOpen = !scope.state.isOpen
        if (scope.state.isOpen) {
          return scope.onOpen().then(() => filterResolvedComments())
        }
      }

      scope.resolvedComments = []

      scope.handleUnresolve = function(threadId) {
        scope.onUnresolve({ threadId })
        return (scope.resolvedComments = scope.resolvedComments.filter(
          c => c.threadId !== threadId
        ))
      }

      scope.handleDelete = function(entryId, docId, threadId) {
        scope.onDelete({ entryId, docId, threadId })
        return (scope.resolvedComments = scope.resolvedComments.filter(
          c => c.threadId !== threadId
        ))
      }

      const getDocNameById = function(docId) {
        const doc = _.find(scope.docs, doc => doc.doc.id === docId)
        if (doc != null) {
          return doc.path
        } else {
          return null
        }
      }

      return (filterResolvedComments = function() {
        scope.resolvedComments = []

        return (() => {
          const result = []
          for (var docId in scope.entries) {
            var docEntries = scope.entries[docId]
            result.push(
              (() => {
                const result1 = []
                for (let entryId in docEntries) {
                  const entry = docEntries[entryId]
                  if (
                    entry.type === 'comment' &&
                    (scope.threads[entry.thread_id] != null
                      ? scope.threads[entry.thread_id].resolved
                      : undefined) != null
                  ) {
                    const resolvedComment = angular.copy(
                      scope.threads[entry.thread_id]
                    )

                    resolvedComment.content = entry.content
                    resolvedComment.threadId = entry.thread_id
                    resolvedComment.entryId = entryId
                    resolvedComment.docId = docId
                    resolvedComment.docName = getDocNameById(docId)

                    result1.push(scope.resolvedComments.push(resolvedComment))
                  } else {
                    result1.push(undefined)
                  }
                }
                return result1
              })()
            )
          }
          return result
        })()
      })
    }
  })))
