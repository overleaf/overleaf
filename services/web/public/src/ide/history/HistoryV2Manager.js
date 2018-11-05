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
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'moment',
  'ide/colors/ColorManager',
  'ide/history/util/displayNameForUser',
  'ide/history/util/HistoryViewModes',
  'ide/history/controllers/HistoryV2ListController',
  'ide/history/controllers/HistoryV2DiffController',
  'ide/history/controllers/HistoryV2FileTreeController',
  'ide/history/controllers/HistoryV2ToolbarController',
  'ide/history/controllers/HistoryV2AddLabelModalController',
  'ide/history/controllers/HistoryV2DeleteLabelModalController',
  'ide/history/directives/infiniteScroll',
  'ide/history/components/historyEntriesList',
  'ide/history/components/historyEntry',
  'ide/history/components/historyLabelsList',
  'ide/history/components/historyLabel',
  'ide/history/components/historyFileTree',
  'ide/history/components/historyFileEntity'
], function(moment, ColorManager, displayNameForUser, HistoryViewModes) {
  let HistoryManager
  return (HistoryManager = (function() {
    HistoryManager = class HistoryManager {
      static initClass() {
        this.prototype.MAX_RECENT_UPDATES_TO_SELECT = 5

        this.prototype.BATCH_SIZE = 10
      }
      constructor(ide, $scope) {
        this.labelCurrentVersion = this.labelCurrentVersion.bind(this)
        this.deleteLabel = this.deleteLabel.bind(this)
        this._addLabelToLocalUpdate = this._addLabelToLocalUpdate.bind(this)
        this.ide = ide
        this.$scope = $scope
        this.reset()
        this.$scope.HistoryViewModes = HistoryViewModes

        this.$scope.toggleHistory = () => {
          if (this.$scope.ui.view === 'history') {
            this.hide()
          } else {
            this.show()
          }
          return this.ide.$timeout(() => {
            return this.$scope.$broadcast('history:toggle')
          }, 0)
        }

        this.$scope.toggleHistoryViewMode = () => {
          if (this.$scope.history.viewMode === HistoryViewModes.COMPARE) {
            this.reset()
            this.$scope.history.viewMode = HistoryViewModes.POINT_IN_TIME
          } else {
            this.reset()
            this.$scope.history.viewMode = HistoryViewModes.COMPARE
          }
          return this.ide.$timeout(() => {
            return this.$scope.$broadcast('history:toggle')
          }, 0)
        }

        this.$scope.$watch('history.selection.updates', updates => {
          if (this.$scope.history.viewMode === HistoryViewModes.COMPARE) {
            if (updates != null && updates.length > 0) {
              this._selectDocFromUpdates()
              return this.reloadDiff()
            }
          }
        })

        this.$scope.$watch('history.selection.pathname', pathname => {
          if (this.$scope.history.viewMode === HistoryViewModes.POINT_IN_TIME) {
            if (pathname != null) {
              return this.loadFileAtPointInTime()
            }
          } else {
            return this.reloadDiff()
          }
        })

        this.$scope.$watch(
          'history.showOnlyLabels',
          (showOnlyLabels, prevVal) => {
            if (showOnlyLabels != null && showOnlyLabels !== prevVal) {
              if (showOnlyLabels) {
                return this.selectedLabelFromUpdatesSelection()
              } else {
                this.$scope.history.selection.label = null
                if (this.$scope.history.selection.updates.length === 0) {
                  return this.autoSelectLastUpdate()
                }
              }
            }
          }
        )

        this.$scope.$watch('history.updates.length', () => {
          return this.recalculateSelectedUpdates()
        })
      }

      show() {
        this.$scope.ui.view = 'history'
        this.reset()
        return (this.$scope.history.viewMode = HistoryViewModes.POINT_IN_TIME)
      }

      hide() {
        return (this.$scope.ui.view = 'editor')
      }

      reset() {
        return (this.$scope.history = {
          isV2: true,
          updates: [],
          viewMode: null,
          nextBeforeTimestamp: null,
          atEnd: false,
          userHasFullFeature:
            __guard__(
              this.$scope.project != null
                ? this.$scope.project.features
                : undefined,
              x => x.versioning
            ) || false,
          freeHistoryLimitHit: false,
          selection: {
            label: null,
            updates: [],
            docs: {},
            pathname: null,
            range: {
              fromV: null,
              toV: null
            }
          },
          error: null,
          showOnlyLabels: false,
          labels: null,
          files: [],
          diff: null, // When history.viewMode == HistoryViewModes.COMPARE
          selectedFile: null // When history.viewMode == HistoryViewModes.POINT_IN_TIME
        })
      }

      restoreFile(version, pathname) {
        const url = `/project/${this.$scope.project_id}/restore_file`

        return this.ide.$http.post(url, {
          version,
          pathname,
          _csrf: window.csrfToken
        })
      }

      loadFileTreeForVersion(version) {
        let url = `/project/${this.$scope.project_id}/filetree/diff`
        const query = [`from=${version}`, `to=${version}`]
        url += `?${query.join('&')}`
        this.$scope.history.loadingFileTree = true
        this.$scope.history.selectedFile = null
        this.$scope.history.selection.pathname = null
        return this.ide.$http.get(url).then(response => {
          this.$scope.history.files = response.data.diff
          return (this.$scope.history.loadingFileTree = false)
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
          if (
            this._updateContainsUserId(update, this.$scope.user.id) ||
            i > this.MAX_RECENT_UPDATES_TO_SELECT
          ) {
            break
          }
          indexOfLastUpdateNotByMe = i
        }

        return (this.$scope.history.updates[
          indexOfLastUpdateNotByMe
        ].selectedFrom = true)
      }

      autoSelectLastUpdate() {
        if (this.$scope.history.updates.length === 0) {
          return
        }
        return this.selectUpdate(this.$scope.history.updates[0])
      }

      autoSelectLastLabel() {
        if (this.$scope.history.labels.length === 0) {
          return
        }
        return this.selectLabel(this.$scope.history.labels[0])
      }

      selectUpdate(update) {
        let selectedUpdateIndex = this.$scope.history.updates.indexOf(update)
        if (selectedUpdateIndex === -1) {
          selectedUpdateIndex = 0
        }
        for (update of Array.from(this.$scope.history.updates)) {
          update.selectedTo = false
          update.selectedFrom = false
        }
        this.$scope.history.updates[selectedUpdateIndex].selectedTo = true
        this.$scope.history.updates[selectedUpdateIndex].selectedFrom = true
        this.recalculateSelectedUpdates()
        return this.loadFileTreeForVersion(
          this.$scope.history.updates[selectedUpdateIndex].toV
        )
      }

      selectedLabelFromUpdatesSelection() {
        // Get the number of labels associated with the currently selected update
        const nSelectedLabels = __guard__(
          __guard__(
            this.$scope.history.selection.updates != null
              ? this.$scope.history.selection.updates[0]
              : undefined,
            x1 => x1.labels
          ),
          x => x.length
        )
        // If the currently selected update has no labels, select the last one (version-wise)
        if (nSelectedLabels === 0) {
          return this.autoSelectLastLabel()
          // If the update has one label, select it
        } else if (nSelectedLabels === 1) {
          return this.selectLabel(
            this.$scope.history.selection.updates[0].labels[0]
          )
          // If there are multiple labels for the update, select the latest
        } else if (nSelectedLabels > 1) {
          const sortedLabels = this.ide.$filter('orderBy')(
            this.$scope.history.selection.updates[0].labels,
            '-created_at'
          )
          const lastLabelFromUpdate = sortedLabels[0]
          return this.selectLabel(lastLabelFromUpdate)
        }
      }

      selectLabel(labelToSelect) {
        let updateToSelect = null

        if (this._isLabelSelected(labelToSelect)) {
          // Label already selected
          return
        }

        for (let update of Array.from(this.$scope.history.updates)) {
          if (update.toV === labelToSelect.version) {
            updateToSelect = update
            break
          }
        }

        this.$scope.history.selection.label = labelToSelect
        if (updateToSelect != null) {
          return this.selectUpdate(updateToSelect)
        } else {
          this.$scope.history.selection.updates = []
          return this.loadFileTreeForVersion(labelToSelect.version)
        }
      }

      recalculateSelectedUpdates() {
        let beforeSelection = true
        let afterSelection = false
        this.$scope.history.selection.updates = []
        return (() => {
          const result = []
          for (let update of Array.from(this.$scope.history.updates)) {
            var inSelection
            if (update.selectedTo) {
              inSelection = true
              beforeSelection = false
            }

            update.beforeSelection = beforeSelection
            update.inSelection = inSelection
            update.afterSelection = afterSelection

            if (inSelection) {
              this.$scope.history.selection.updates.push(update)
            }

            if (update.selectedFrom) {
              inSelection = false
              result.push((afterSelection = true))
            } else {
              result.push(undefined)
            }
          }
          return result
        })()
      }
      fetchNextBatchOfUpdates() {
        let updatesURL = `/project/${this.ide.project_id}/updates?min_count=${
          this.BATCH_SIZE
        }`
        if (this.$scope.history.nextBeforeTimestamp != null) {
          updatesURL += `&before=${this.$scope.history.nextBeforeTimestamp}`
        }
        const labelsURL = `/project/${this.ide.project_id}/labels`

        this.$scope.history.loading = true
        this.$scope.history.loadingFileTree = true

        const requests = { updates: this.ide.$http.get(updatesURL) }

        if (this.$scope.history.labels == null) {
          requests.labels = this.ide.$http.get(labelsURL)
        }

        return this.ide.$q
          .all(requests)
          .then(response => {
            const updatesData = response.updates.data
            if (response.labels != null) {
              this.$scope.history.labels = this._sortLabelsByVersionAndDate(
                response.labels.data
              )
            }
            this._loadUpdates(updatesData.updates)
            this.$scope.history.nextBeforeTimestamp =
              updatesData.nextBeforeTimestamp
            if (
              updatesData.nextBeforeTimestamp == null ||
              this.$scope.history.freeHistoryLimitHit
            ) {
              this.$scope.history.atEnd = true
            }
            this.$scope.history.loading = false
            if (this.$scope.history.updates.length === 0) {
              return (this.$scope.history.loadingFileTree = false)
            }
          })
          .catch(error => {
            const { status, statusText } = error
            this.$scope.history.error = { status, statusText }
            this.$scope.history.loading = false
            return (this.$scope.history.loadingFileTree = false)
          })
      }

      _sortLabelsByVersionAndDate(labels) {
        return this.ide.$filter('orderBy')(labels, ['-version', '-created_at'])
      }

      loadFileAtPointInTime() {
        let toV
        const { pathname } = this.$scope.history.selection
        if (
          (this.$scope.history.selection.updates != null
            ? this.$scope.history.selection.updates[0]
            : undefined) != null
        ) {
          ;({ toV } = this.$scope.history.selection.updates[0])
        } else if (this.$scope.history.selection.label != null) {
          toV = this.$scope.history.selection.label.version
        }

        if (toV == null) {
          return
        }
        let url = `/project/${this.$scope.project_id}/diff`
        const query = [
          `pathname=${encodeURIComponent(pathname)}`,
          `from=${toV}`,
          `to=${toV}`
        ]
        url += `?${query.join('&')}`
        this.$scope.history.selectedFile = { loading: true }
        return this.ide.$http
          .get(url)
          .then(response => {
            const { text, binary } = this._parseDiff(response.data.diff)
            this.$scope.history.selectedFile.binary = binary
            this.$scope.history.selectedFile.text = text
            return (this.$scope.history.selectedFile.loading = false)
          })
          .catch(function() {})
      }

      reloadDiff() {
        let { diff } = this.$scope.history
        const { updates } = this.$scope.history.selection
        const { fromV, toV, pathname } = this._calculateDiffDataFromSelection()

        if (pathname == null) {
          this.$scope.history.diff = null
          return
        }

        if (
          diff != null &&
          diff.pathname === pathname &&
          diff.fromV === fromV &&
          diff.toV === toV
        ) {
          return
        }

        this.$scope.history.diff = diff = {
          fromV,
          toV,
          pathname,
          error: false
        }

        diff.loading = true
        let url = `/project/${this.$scope.project_id}/diff`
        const query = [`pathname=${encodeURIComponent(pathname)}`]
        if (diff.fromV != null && diff.toV != null) {
          query.push(`from=${diff.fromV}`, `to=${diff.toV}`)
        }
        url += `?${query.join('&')}`

        return this.ide.$http
          .get(url)
          .then(response => {
            const { data } = response
            diff.loading = false
            const { text, highlights, binary } = this._parseDiff(data.diff)
            diff.binary = binary
            diff.text = text
            return (diff.highlights = highlights)
          })
          .catch(function() {
            diff.loading = false
            return (diff.error = true)
          })
      }

      labelCurrentVersion(labelComment) {
        return this._labelVersion(
          labelComment,
          this.$scope.history.selection.updates[0].toV
        )
      }

      deleteLabel(label) {
        const url = `/project/${this.$scope.project_id}/labels/${label.id}`

        return this.ide
          .$http({
            url,
            method: 'DELETE',
            headers: {
              'X-CSRF-Token': window.csrfToken
            }
          })
          .then(response => {
            return this._deleteLabelLocally(label)
          })
      }

      _isLabelSelected(label) {
        return (
          label.id ===
          (this.$scope.history.selection.label != null
            ? this.$scope.history.selection.label.id
            : undefined)
        )
      }

      _deleteLabelLocally(labelToDelete) {
        for (let i = 0; i < this.$scope.history.updates.length; i++) {
          const update = this.$scope.history.updates[i]
          if (update.toV === labelToDelete.version) {
            update.labels = _.filter(
              update.labels,
              label => label.id !== labelToDelete.id
            )
            break
          }
        }
        return (this.$scope.history.labels = _.filter(
          this.$scope.history.labels,
          label => label.id !== labelToDelete.id
        ))
      }

      _parseDiff(diff) {
        if (diff.binary) {
          return { binary: true }
        }
        let row = 0
        let column = 0
        const highlights = []
        let text = ''
        const iterable = diff || []
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
            const user =
              entry.meta.users != null ? entry.meta.users[0] : undefined
            const name = displayNameForUser(user)
            const date = moment(entry.meta.end_ts).format('Do MMM YYYY, h:mm a')
            if (entry.i != null) {
              highlights.push({
                label: `Added by ${name} on ${date}`,
                highlight: range,
                hue: ColorManager.getHueForUserId(
                  user != null ? user.id : undefined
                )
              })
            } else if (entry.d != null) {
              highlights.push({
                label: `Deleted by ${name} on ${date}`,
                strikeThrough: range,
                hue: ColorManager.getHueForUserId(
                  user != null ? user.id : undefined
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
        const dateTimeNow = new Date()
        const timestamp24hoursAgo = dateTimeNow.setDate(
          dateTimeNow.getDate() - 1
        )
        let cutOffIndex = null

        const iterable = updates || []
        for (let i = 0; i < iterable.length; i++) {
          const update = iterable[i]
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

          if (
            !this.$scope.history.userHasFullFeature &&
            update.meta.end_ts < timestamp24hoursAgo
          ) {
            cutOffIndex = i || 1 // Make sure that we show at least one entry (to allow labelling).
            this.$scope.history.freeHistoryLimitHit = true
            break
          }
        }

        const firstLoad = this.$scope.history.updates.length === 0

        if (!this.$scope.history.userHasFullFeature && cutOffIndex != null) {
          updates = updates.slice(0, cutOffIndex)
        }

        this.$scope.history.updates = this.$scope.history.updates.concat(
          updates
        )

        if (firstLoad) {
          if (this.$scope.history.viewMode === HistoryViewModes.COMPARE) {
            return this.autoSelectRecentUpdates()
          } else {
            if (this.$scope.history.showOnlyLabels) {
              return this.autoSelectLastLabel()
            } else {
              return this.autoSelectLastUpdate()
            }
          }
        }
      }

      _labelVersion(comment, version) {
        const url = `/project/${this.$scope.project_id}/labels`
        return this.ide.$http
          .post(url, {
            comment,
            version,
            _csrf: window.csrfToken
          })
          .then(response => {
            return this._addLabelToLocalUpdate(response.data)
          })
      }

      _addLabelToLocalUpdate(label) {
        const localUpdate = _.find(
          this.$scope.history.updates,
          update => update.toV === label.version
        )
        if (localUpdate != null) {
          localUpdate.labels = this._sortLabelsByVersionAndDate(
            localUpdate.labels.concat(label)
          )
        }
        return (this.$scope.history.labels = this._sortLabelsByVersionAndDate(
          this.$scope.history.labels.concat(label)
        ))
      }

      _perDocSummaryOfUpdates(updates) {
        // Track current_pathname -> original_pathname
        // create bare object for use as Map
        // http://ryanmorr.com/true-hash-maps-in-javascript/
        const original_pathnames = Object.create(null)

        // Map of original pathname -> doc summary
        const docs_summary = Object.create(null)

        const updatePathnameWithUpdateVersions = function(
          pathname,
          update,
          deletedAtV
        ) {
          // docs_summary is indexed by the original pathname the doc
          // had at the start, so we have to look this up from the current
          // pathname via original_pathname first
          if (original_pathnames[pathname] == null) {
            original_pathnames[pathname] = pathname
          }
          const original_pathname = original_pathnames[pathname]
          const doc_summary =
            docs_summary[original_pathname] != null
              ? docs_summary[original_pathname]
              : (docs_summary[original_pathname] = {
                  fromV: update.fromV,
                  toV: update.toV
                })
          doc_summary.fromV = Math.min(doc_summary.fromV, update.fromV)
          doc_summary.toV = Math.max(doc_summary.toV, update.toV)
          if (deletedAtV != null) {
            return (doc_summary.deletedAtV = deletedAtV)
          }
        }

        // Put updates in ascending chronological order
        updates = updates.slice().reverse()
        for (let update of Array.from(updates)) {
          for (let pathname of Array.from(update.pathnames || [])) {
            updatePathnameWithUpdateVersions(pathname, update)
          }
          for (let project_op of Array.from(update.project_ops || [])) {
            if (project_op.rename != null) {
              const { rename } = project_op
              updatePathnameWithUpdateVersions(rename.pathname, update)
              original_pathnames[rename.newPathname] =
                original_pathnames[rename.pathname]
              delete original_pathnames[rename.pathname]
            }
            if (project_op.add != null) {
              const { add } = project_op
              updatePathnameWithUpdateVersions(add.pathname, update)
            }
            if (project_op.remove != null) {
              const { remove } = project_op
              updatePathnameWithUpdateVersions(
                remove.pathname,
                update,
                project_op.atV
              )
            }
          }
        }

        return docs_summary
      }

      _calculateDiffDataFromSelection() {
        let pathname, toV
        let fromV = (toV = pathname = null)

        const selected_pathname = this.$scope.history.selection.pathname

        const object = this._perDocSummaryOfUpdates(
          this.$scope.history.selection.updates
        )
        for (pathname in object) {
          const doc = object[pathname]
          if (pathname === selected_pathname) {
            ;({ fromV, toV } = doc)
            return { fromV, toV, pathname }
          }
        }

        return {}
      }

      // Set the track changes selected doc to one of the docs in the range
      // of currently selected updates. If we already have a selected doc
      // then prefer this one if present.
      _selectDocFromUpdates() {
        let pathname
        const affected_docs = this._perDocSummaryOfUpdates(
          this.$scope.history.selection.updates
        )
        this.$scope.history.selection.docs = affected_docs

        let selected_pathname = this.$scope.history.selection.pathname
        if (selected_pathname != null && affected_docs[selected_pathname]) {
          // Selected doc is already open
        } else {
          // Set to first possible candidate
          for (pathname in affected_docs) {
            const doc = affected_docs[pathname]
            selected_pathname = pathname
            break
          }
        }

        return (this.$scope.history.selection.pathname = selected_pathname)
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

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
