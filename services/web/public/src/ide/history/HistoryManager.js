/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'moment',
  'ide/colors/ColorManager',
  'ide/history/util/displayNameForUser',
  'ide/history/controllers/HistoryListController',
  'ide/history/controllers/HistoryDiffController',
  'ide/history/directives/infiniteScroll'
], function(moment, ColorManager, displayNameForUser) {
  let HistoryManager
  return (HistoryManager = (function() {
    HistoryManager = class HistoryManager {
      static initClass() {
        this.prototype.BATCH_SIZE = 10
      }
      constructor(ide, $scope) {
        this.ide = ide
        this.$scope = $scope
        this.reset()

        this.$scope.toggleHistory = () => {
          if (this.$scope.ui.view === 'history') {
            return this.hide()
          } else {
            return this.show()
          }
        }

        this.$scope.$watch('history.selection.updates', updates => {
          if (updates != null && updates.length > 0) {
            this._selectDocFromUpdates()
            return this.reloadDiff()
          }
        })

        this.$scope.$on('entity:selected', (event, entity) => {
          if (this.$scope.ui.view === 'history' && entity.type === 'doc') {
            this.$scope.history.selection.doc = entity
            return this.reloadDiff()
          }
        })
      }

      show() {
        this.$scope.ui.view = 'history'
        return this.reset()
      }

      hide() {
        this.$scope.ui.view = 'editor'
        // Make sure we run the 'open' logic for whatever is currently selected
        return this.$scope.$emit(
          'entity:selected',
          this.ide.fileTreeManager.findSelectedEntity()
        )
      }

      reset() {
        return (this.$scope.history = {
          updates: [],
          nextBeforeTimestamp: null,
          atEnd: false,
          selection: {
            updates: [],
            doc: null,
            range: {
              fromV: null,
              toV: null,
              start_ts: null,
              end_ts: null
            }
          },
          diff: null
        })
      }

      autoSelectRecentUpdates() {
        if (this.$scope.history.updates.length === 0) {
          return
        }

        this.$scope.history.updates[0].selectedTo = true

        let indexOfLastUpdateNotByMe = 0
        for (let i = 0; i < this.$scope.history.updates.length; i++) {
          const update = this.$scope.history.updates[i]
          if (this._updateContainsUserId(update, this.$scope.user.id)) {
            break
          }
          indexOfLastUpdateNotByMe = i
        }

        return (this.$scope.history.updates[
          indexOfLastUpdateNotByMe
        ].selectedFrom = true)
      }
      fetchNextBatchOfUpdates() {
        let url = `/project/${this.ide.project_id}/updates?min_count=${
          this.BATCH_SIZE
        }`
        if (this.$scope.history.nextBeforeTimestamp != null) {
          url += `&before=${this.$scope.history.nextBeforeTimestamp}`
        }
        this.$scope.history.loading = true
        return this.ide.$http.get(url).then(response => {
          const { data } = response
          this._loadUpdates(data.updates)
          this.$scope.history.nextBeforeTimestamp = data.nextBeforeTimestamp
          if (data.nextBeforeTimestamp == null) {
            this.$scope.history.atEnd = true
          }
          return (this.$scope.history.loading = false)
        })
      }

      reloadDiff() {
        let { diff } = this.$scope.history
        const { updates, doc } = this.$scope.history.selection
        const {
          fromV,
          toV,
          start_ts,
          end_ts
        } = this._calculateRangeFromSelection()

        if (doc == null) {
          return
        }

        if (
          diff != null &&
          diff.doc === doc &&
          diff.fromV === fromV &&
          diff.toV === toV
        ) {
          return
        }

        this.$scope.history.diff = diff = {
          fromV,
          toV,
          start_ts,
          end_ts,
          doc,
          error: false,
          pathname: doc.name
        }

        if (!doc.deleted) {
          diff.loading = true
          let url = `/project/${this.$scope.project_id}/doc/${diff.doc.id}/diff`
          if (diff.fromV != null && diff.toV != null) {
            url += `?from=${diff.fromV}&to=${diff.toV}`
          }

          return this.ide.$http
            .get(url)
            .then(response => {
              const { data } = response
              diff.loading = false
              const { text, highlights } = this._parseDiff(data)
              diff.text = text
              return (diff.highlights = highlights)
            })
            .catch(function() {
              diff.loading = false
              return (diff.error = true)
            })
        } else {
          diff.deleted = true
          diff.restoreInProgress = false
          diff.restoreDeletedSuccess = false
          return (diff.restoredDocNewId = null)
        }
      }

      restoreDeletedDoc(doc) {
        const url = `/project/${this.$scope.project_id}/doc/${doc.id}/restore`
        return this.ide.$http.post(url, {
          name: doc.name,
          _csrf: window.csrfToken
        })
      }

      restoreDiff(diff) {
        const url = `/project/${this.$scope.project_id}/doc/${
          diff.doc.id
        }/version/${diff.fromV}/restore`
        return this.ide.$http.post(url, { _csrf: window.csrfToken })
      }

      _parseDiff(diff) {
        let row = 0
        let column = 0
        const highlights = []
        let text = ''
        const iterable = diff.diff || []
        for (let i = 0; i < iterable.length; i++) {
          var endColumn, endRow
          const entry = iterable[i]
          let content = entry.u || entry.i || entry.d
          if (!content) {
            content = ''
          }
          text += content
          const lines = content.split('\n')
          const startRow = row
          const startColumn = column
          if (lines.length > 1) {
            endRow = startRow + lines.length - 1
            endColumn = lines[lines.length - 1].length
          } else {
            endRow = startRow
            endColumn = startColumn + lines[0].length
          }
          row = endRow
          column = endColumn

          const range = {
            start: {
              row: startRow,
              column: startColumn
            },
            end: {
              row: endRow,
              column: endColumn
            }
          }

          if (entry.i != null || entry.d != null) {
            const name = displayNameForUser(entry.meta.user)
            const date = moment(entry.meta.end_ts).format('Do MMM YYYY, h:mm a')
            if (entry.i != null) {
              highlights.push({
                label: `Added by ${name} on ${date}`,
                highlight: range,
                hue: ColorManager.getHueForUserId(
                  entry.meta.user != null ? entry.meta.user.id : undefined
                )
              })
            } else if (entry.d != null) {
              highlights.push({
                label: `Deleted by ${name} on ${date}`,
                strikeThrough: range,
                hue: ColorManager.getHueForUserId(
                  entry.meta.user != null ? entry.meta.user.id : undefined
                )
              })
            }
          }
        }

        return { text, highlights }
      }

      _loadUpdates(updates) {
        if (updates == null) {
          updates = []
        }
        let previousUpdate = this.$scope.history.updates[
          this.$scope.history.updates.length - 1
        ]

        for (let update of Array.from(updates)) {
          update.pathnames = [] // Used for display
          const object = update.docs || {}
          for (let doc_id in object) {
            const doc = object[doc_id]
            doc.entity = this.ide.fileTreeManager.findEntityById(doc_id, {
              includeDeleted: true
            })
            update.pathnames.push(doc.entity.name)
          }

          for (let user of Array.from(update.meta.users || [])) {
            if (user != null) {
              user.hue = ColorManager.getHueForUserId(user.id)
            }
          }

          if (
            previousUpdate == null ||
            !moment(previousUpdate.meta.end_ts).isSame(
              update.meta.end_ts,
              'day'
            )
          ) {
            update.meta.first_in_day = true
          }

          update.selectedFrom = false
          update.selectedTo = false
          update.inSelection = false

          previousUpdate = update
        }

        const firstLoad = this.$scope.history.updates.length === 0

        this.$scope.history.updates = this.$scope.history.updates.concat(
          updates
        )

        if (firstLoad) {
          return this.autoSelectRecentUpdates()
        }
      }

      _calculateRangeFromSelection() {
        let end_ts, start_ts, toV
        let fromV = (toV = start_ts = end_ts = null)

        const selected_doc_id =
          this.$scope.history.selection.doc != null
            ? this.$scope.history.selection.doc.id
            : undefined

        for (let update of Array.from(
          this.$scope.history.selection.updates || []
        )) {
          for (let doc_id in update.docs) {
            const doc = update.docs[doc_id]
            if (doc_id === selected_doc_id) {
              if (fromV != null && toV != null) {
                fromV = Math.min(fromV, doc.fromV)
                toV = Math.max(toV, doc.toV)
                start_ts = Math.min(start_ts, update.meta.start_ts)
                end_ts = Math.max(end_ts, update.meta.end_ts)
              } else {
                ;({ fromV } = doc)
                ;({ toV } = doc)
                ;({ start_ts } = update.meta)
                ;({ end_ts } = update.meta)
              }
              break
            }
          }
        }

        return { fromV, toV, start_ts, end_ts }
      }

      // Set the track changes selected doc to one of the docs in the range
      // of currently selected updates. If we already have a selected doc
      // then prefer this one if present.
      _selectDocFromUpdates() {
        let doc, doc_id
        const affected_docs = {}
        for (let update of Array.from(this.$scope.history.selection.updates)) {
          for (doc_id in update.docs) {
            doc = update.docs[doc_id]
            affected_docs[doc_id] = doc.entity
          }
        }

        let selected_doc = this.$scope.history.selection.doc
        if (selected_doc != null && affected_docs[selected_doc.id] != null) {
          // Selected doc is already open
        } else {
          for (doc_id in affected_docs) {
            doc = affected_docs[doc_id]
            selected_doc = doc
            break
          }
        }

        this.$scope.history.selection.doc = selected_doc
        return this.ide.fileTreeManager.selectEntity(selected_doc)
      }

      _updateContainsUserId(update, user_id) {
        for (let user of Array.from(update.meta.users)) {
          if ((user != null ? user.id : undefined) === user_id) {
            return true
          }
        }
        return false
      }
    }
    HistoryManager.initClass()
    return HistoryManager
  })())
})
