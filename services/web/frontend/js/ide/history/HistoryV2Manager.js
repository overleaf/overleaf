import _ from 'lodash'
/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
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
import moment from 'moment'
import ColorManager from '../colors/ColorManager'
import displayNameForUser from './util/displayNameForUser'
import HistoryViewModes from './util/HistoryViewModes'
import './controllers/HistoryV2ListController'
import './controllers/HistoryV2FileTreeController'
import './controllers/HistoryV2ToolbarController'
import './controllers/HistoryV2AddLabelModalController'
import './controllers/HistoryV2DeleteLabelModalController'
import './directives/infiniteScroll'
import './directives/historyDraggableBoundary'
import './directives/historyDroppableArea'
import './components/historyEntriesList'
import './components/historyEntry'
import './components/historyLabelsList'
import './components/historyLabel'
import './components/historyFileTree'
import './components/historyFileEntity'
import { paywallPrompt } from '../../../../frontend/js/main/account-upgrade'
import getMeta from '../../utils/meta'
let HistoryManager

export default HistoryManager = (function () {
  HistoryManager = class HistoryManager {
    static initClass() {
      this.prototype.MAX_RECENT_UPDATES_TO_SELECT = 5
      this.prototype.BATCH_SIZE = 10
    }

    constructor(ide, $scope, localStorage) {
      this.labelCurrentVersion = this.labelCurrentVersion.bind(this)
      this.deleteLabel = this.deleteLabel.bind(this)
      this._addLabelLocally = this._addLabelLocally.bind(this)
      this.ide = ide
      this.$scope = $scope
      this.localStorage = localStorage
      this.$scope.HistoryViewModes = HistoryViewModes
      this._localStorageViewModeProjKey = `history.userPrefs.viewMode.${$scope.project_id}`
      this._localStorageShowOnlyLabelsProjKey = `history.userPrefs.showOnlyLabels.${$scope.project_id}`
      this._previouslySelectedPathname = null
      this._loadFileTreeRequestCanceller = null
      this.hardReset()

      this.$scope.toggleHistory = () => {
        if (this.$scope.ui.view === 'history') {
          this.hide()
        } else {
          this.show()
          this._handleHistoryUIStateChange()
        }
        this.ide.$timeout(() => {
          this.$scope.$broadcast('history:toggle')
        }, 0)
      }

      this.$scope.isHistoryLoading = () => {
        const selection = this.$scope.history.selection
        return (
          this.$scope.history.loadingFileTree ||
          (this.$scope.history.viewMode === HistoryViewModes.POINT_IN_TIME &&
            selection.file &&
            selection.file.loading) ||
          (this.$scope.history.viewMode === HistoryViewModes.COMPARE &&
            selection.diff &&
            selection.diff.loading)
        )
      }
    }

    show() {
      this.$scope.ui.view = 'history'
      this.hardReset()
      if (this.$scope.history.showOnlyLabels) {
        this.fetchNextBatchOfUpdates()
      }
    }

    hide() {
      this.$scope.ui.view = 'editor'
    }

    _getViewModeUserPref() {
      return (
        this.localStorage(this._localStorageViewModeProjKey) ||
        HistoryViewModes.POINT_IN_TIME
      )
    }

    _getShowOnlyLabelsUserPref() {
      return this.localStorage(this._localStorageShowOnlyLabelsProjKey) || false
    }

    _setViewModeUserPref(viewModeUserPref) {
      if (
        viewModeUserPref === HistoryViewModes.POINT_IN_TIME ||
        viewModeUserPref === HistoryViewModes.COMPARE
      ) {
        this.localStorage(this._localStorageViewModeProjKey, viewModeUserPref)
      }
    }

    _setShowOnlyLabelsUserPref(showOnlyLabelsUserPref) {
      this.localStorage(
        this._localStorageShowOnlyLabelsProjKey,
        !!showOnlyLabelsUserPref
      )
    }

    isReact() {
      return getMeta('ol-splitTestVariants')?.['history-view'] === 'react'
    }

    hardReset() {
      this.$scope.history = {
        isV2: true,
        updates: [],
        viewMode: this._getViewModeUserPref(),
        nextBeforeTimestamp: null,
        loading: false,
        atEnd: false,
        userHasFullFeature: undefined,
        freeHistoryLimitHit: false,
        selection: {
          docs: {},
          pathname: null,
          range: {
            fromV: null,
            toV: null,
          },
          hoveredRange: {
            fromV: null,
            toV: null,
          },
          diff: null,
          files: [],
          file: null,
        },
        error: null,
        showOnlyLabels: this._getShowOnlyLabelsUserPref(),
        labels: null,
        loadingFileTree: true,
        isReact: this.isReact(),
      }
      const _deregisterFeatureWatcher = this.$scope.$watch(
        'project.features.versioning',
        hasVersioning => {
          if (hasVersioning != null) {
            this.$scope.history.userHasFullFeature = hasVersioning
            if (this.$scope.user.isAdmin) {
              this.$scope.history.userHasFullFeature = true
            }
            _deregisterFeatureWatcher()
          }
        }
      )
    }

    softReset() {
      this.$scope.history.viewMode = this._getViewModeUserPref()
      this.$scope.history.selection = {
        docs: {},
        pathname: null,
        range: {
          fromV: null,
          toV: null,
        },
        hoveredRange: {
          fromV: null,
          toV: null,
        },
        diff: null, // When history.viewMode == HistoryViewModes.COMPARE
        files: [], // When history.viewMode == HistoryViewModes.COMPARE
        file: null,
      }
      this.$scope.history.error = null
      this.$scope.history.showOnlyLabels = this._getShowOnlyLabelsUserPref()
    }

    toggleHistoryViewMode() {
      if (this.$scope.history.viewMode === HistoryViewModes.COMPARE) {
        this.softReset()
        this.$scope.history.viewMode = HistoryViewModes.POINT_IN_TIME
        this._setViewModeUserPref(HistoryViewModes.POINT_IN_TIME)
      } else {
        this.softReset()
        this.$scope.history.viewMode = HistoryViewModes.COMPARE
        this._setViewModeUserPref(HistoryViewModes.COMPARE)
      }
      this._handleHistoryUIStateChange()
      this.ide.$timeout(() => {
        this.$scope.$broadcast('history:toggle')
      }, 0)
    }

    _handleHistoryUIStateChange() {
      if (this.$scope.history.viewMode === HistoryViewModes.COMPARE) {
        if (this.$scope.history.showOnlyLabels) {
          this.autoSelectLabelsForComparison()
        } else {
          this.autoSelectRecentUpdates()
        }
      } else {
        // Point-in-time mode
        if (this.$scope.history.showOnlyLabels) {
          this.autoSelectLabelForPointInTime()
        } else {
          this.autoSelectVersionForPointInTime()
        }
      }
    }

    setHoverFrom(fromV) {
      const selection = this.$scope.history.selection
      selection.hoveredRange.fromV = fromV
      selection.hoveredRange.toV = selection.range.toV
      this.$scope.history.hoveringOverListSelectors = true
    }

    setHoverTo(toV) {
      const selection = this.$scope.history.selection
      selection.hoveredRange.toV = toV
      selection.hoveredRange.fromV = selection.range.fromV
      this.$scope.history.hoveringOverListSelectors = true
    }

    resetHover() {
      const selection = this.$scope.history.selection
      selection.hoveredRange.toV = null
      selection.hoveredRange.fromV = null
      this.$scope.history.hoveringOverListSelectors = false
    }

    showAllUpdates() {
      if (this.$scope.history.showOnlyLabels) {
        this.$scope.history.showOnlyLabels = false
        this._setShowOnlyLabelsUserPref(false)
        this._handleHistoryUIStateChange()
      }
    }

    showOnlyLabels() {
      if (!this.$scope.history.showOnlyLabels) {
        this.$scope.history.showOnlyLabels = true
        this._setShowOnlyLabelsUserPref(true)
        this._handleHistoryUIStateChange()
      }
    }

    restoreFile(version, pathname) {
      const url = `/project/${this.$scope.project_id}/restore_file`

      return this.ide.$http.post(url, {
        version,
        pathname,
        _csrf: window.csrfToken,
      })
    }

    loadFileTreeForVersion(version) {
      return this._loadFileTree(version, version)
    }

    loadFileTreeDiff(toV, fromV) {
      return this._loadFileTree(toV, fromV)
    }

    _loadFileTree(toV, fromV) {
      let url = `/project/${this.$scope.project_id}/filetree/diff`
      const selection = this.$scope.history.selection
      const query = [`from=${fromV}`, `to=${toV}`]
      url += `?${query.join('&')}`

      this.$scope.$applyAsync(
        () => (this.$scope.history.loadingFileTree = true)
      )

      selection.file = null
      selection.pathname = null

      // If `this._loadFileTreeRequestCanceller` is not null, then we have a request inflight
      if (this._loadFileTreeRequestCanceller != null) {
        // Resolving it will cancel the inflight request (or, rather, ignore its result)
        this._loadFileTreeRequestCanceller.resolve()
      }
      this._loadFileTreeRequestCanceller = this.ide.$q.defer()

      return this.ide.$http
        .get(url, { timeout: this._loadFileTreeRequestCanceller.promise })
        .then(response => {
          this.$scope.history.selection.files = response.data.diff
          for (const file of this.$scope.history.selection.files) {
            if (file.newPathname != null) {
              file.oldPathname = file.pathname
              file.pathname = file.newPathname
              delete file.newPathname
            }
          }
          this._loadFileTreeRequestCanceller = null
          this.$scope.history.loadingFileTree = false
          this.autoSelectFile()
        })
        .catch(err => {
          if (err.status !== -1) {
            this._loadFileTreeRequestCanceller = null
          } else {
            this.$scope.history.loadingFileTree = false
          }
        })
    }

    selectFile(file) {
      if (file != null && file.pathname != null) {
        this.$scope.history.selection.pathname =
          this._previouslySelectedPathname = file.pathname
        this.$scope.history.selection.file = file
        if (this.$scope.history.viewMode === HistoryViewModes.POINT_IN_TIME) {
          this.loadFileAtPointInTime()
        } else {
          this.reloadDiff()
        }
      }
    }

    autoSelectFile() {
      const selectedPathname = null
      const files = this.$scope.history.selection.files
      let fileToSelect = null
      let previouslySelectedFile = null
      let previouslySelectedFileHasOp = false
      const filesWithOps = this._getFilesWithOps()
      const orderedOpTypes = ['edited', 'added', 'renamed', 'removed']

      if (this._previouslySelectedPathname != null) {
        previouslySelectedFile = _.find(files, {
          pathname: this._previouslySelectedPathname,
        })
        previouslySelectedFileHasOp = _.some(filesWithOps, {
          pathname: this._previouslySelectedPathname,
        })
      }
      if (previouslySelectedFile != null && previouslySelectedFileHasOp) {
        fileToSelect = previouslySelectedFile
      } else {
        for (const opType of orderedOpTypes) {
          const fileWithMatchingOpType = _.find(filesWithOps, {
            operation: opType,
          })
          if (fileWithMatchingOpType != null) {
            fileToSelect = _.find(files, {
              pathname: fileWithMatchingOpType.pathname,
            })
            break
          }
        }
        if (fileToSelect == null) {
          if (previouslySelectedFile != null) {
            fileToSelect = previouslySelectedFile
          } else {
            const mainFile = _.find(files, function (file) {
              return /main\.tex$/.test(file.pathname)
            })
            if (mainFile != null) {
              fileToSelect = mainFile
            } else {
              const anyTeXFile = _.find(files, function (file) {
                return /\.tex$/.test(file.pathname)
              })
              if (anyTeXFile != null) {
                fileToSelect = anyTeXFile
              } else {
                fileToSelect = files[0]
              }
            }
          }
        }
      }

      this.selectFile(fileToSelect)
    }

    _getFilesWithOps() {
      let filesWithOps
      if (this.$scope.history.viewMode === HistoryViewModes.POINT_IN_TIME) {
        const currentUpdate = this.getUpdateForVersion(
          this.$scope.history.selection.range.toV
        )
        filesWithOps = []
        if (currentUpdate != null) {
          for (const pathname of currentUpdate.pathnames) {
            filesWithOps.push({
              pathname,
              operation: 'edited',
            })
          }
          for (const op of currentUpdate.project_ops) {
            let fileWithOp
            if (op.add != null) {
              fileWithOp = {
                pathname: op.add.pathname,
                operation: 'added',
              }
            } else if (op.remove != null) {
              fileWithOp = {
                pathname: op.remove.pathname,
                operation: 'removed',
              }
            } else if (op.rename != null) {
              fileWithOp = {
                pathname: op.rename.newPathname,
                operation: 'renamed',
              }
            }
            if (fileWithOp != null) {
              filesWithOps.push(fileWithOp)
            }
          }
        }
      } else {
        filesWithOps = _.reduce(
          this.$scope.history.selection.files,
          (curFilesWithOps, file) => {
            if (file.operation) {
              curFilesWithOps.push({
                pathname: file.pathname,
                operation: file.operation,
              })
            }
            return curFilesWithOps
          },
          []
        )
      }
      return filesWithOps
    }

    autoSelectRecentUpdates() {
      if (this.$scope.history.updates.length === 0) {
        return
      }

      const toV = this.$scope.history.updates[0].toV
      let fromV = null

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

      fromV = this.$scope.history.updates[indexOfLastUpdateNotByMe].fromV
      this.selectVersionsForCompare(toV, fromV)
    }

    autoSelectVersionForPointInTime() {
      if (this.$scope.history.updates.length === 0) {
        return
      }
      let versionToSelect = this.$scope.history.updates[0].toV
      const range = this.$scope.history.selection.range
      if (
        range.toV != null &&
        range.fromV != null &&
        range.toV === range.fromV
      ) {
        versionToSelect = range.toV
      }
      this.selectVersionForPointInTime(versionToSelect)
    }

    autoSelectLastLabel() {
      if (
        this.$scope.history.labels == null ||
        this.$scope.history.labels.length === 0
      ) {
        return
      }
      return this.selectLabelForPointInTime(this.$scope.history.labels[0])
    }

    expandSelectionToVersion(version) {
      if (version > this.$scope.history.selection.range.toV) {
        this.$scope.history.selection.range.toV = version
      } else if (version < this.$scope.history.selection.range.fromV) {
        this.$scope.history.selection.range.fromV = version
      }
    }

    selectVersionForPointInTime(version) {
      const selection = this.$scope.history.selection
      if (
        selection.range.toV !== version &&
        selection.range.fromV !== version
      ) {
        selection.range.toV = version
        selection.range.fromV = version
        this.loadFileTreeForVersion(version)
      }
    }

    selectVersionsForCompare(toV, fromV) {
      const range = this.$scope.history.selection.range
      if (range.toV !== toV || range.fromV !== fromV) {
        range.toV = toV
        range.fromV = fromV
        this.loadFileTreeDiff(toV, fromV)
      }
    }

    autoSelectLabelForPointInTime() {
      const selectedUpdate = this.getUpdateForVersion(
        this.$scope.history.selection.range.toV
      )
      let nSelectedLabels = 0

      if (selectedUpdate != null && selectedUpdate.labels != null) {
        nSelectedLabels = selectedUpdate.labels.length
      }

      // If the currently selected update has no labels, select the last one (version-wise)
      if (nSelectedLabels === 0) {
        this.autoSelectLastLabel()
        // If the update has one label, select it
      } else if (nSelectedLabels === 1) {
        this.selectLabelForPointInTime(selectedUpdate.labels[0])
        // If there are multiple labels for the update, select the latest
      } else if (nSelectedLabels > 1) {
        const sortedLabels = this.ide.$filter('orderBy')(
          selectedUpdate.labels,
          '-created_at'
        )
        const lastLabelFromUpdate = sortedLabels[0]
        this.selectLabelForPointInTime(lastLabelFromUpdate)
      }
    }

    selectLabelForPointInTime(labelToSelect) {
      let updateToSelect = null

      if (this._isLabelSelected(labelToSelect)) {
        // Label already selected
        return
      }

      for (const update of Array.from(this.$scope.history.updates)) {
        if (update.toV === labelToSelect.version) {
          updateToSelect = update
          break
        }
      }

      if (updateToSelect != null) {
        this.selectVersionForPointInTime(updateToSelect.toV)
      } else {
        const selection = this.$scope.history.selection
        selection.range.toV = labelToSelect.version
        selection.range.fromV = labelToSelect.version
        this.loadFileTreeForVersion(labelToSelect.version)
      }
    }

    getUpdateForVersion(version) {
      for (const update of this.$scope.history.updates) {
        if (update.toV === version) {
          return update
        }
      }
    }

    autoSelectLabelsForComparison() {
      const labels = this.$scope.history.labels
      let nLabels = 0
      if (Array.isArray(labels)) {
        nLabels = labels.length
      }
      if (nLabels === 0) {
        // TODO better handling
      } else if (nLabels === 1) {
        this.selectVersionsForCompare(labels[0].version, labels[0].version)
      } else if (nLabels > 1) {
        this.selectVersionsForCompare(labels[0].version, labels[1].version)
      }
    }

    fetchNextBatchOfUpdates() {
      if (this.$scope.history.atEnd) {
        return
      }

      let updatesURL = `/project/${this.ide.project_id}/updates?min_count=${this.BATCH_SIZE}`
      if (this.$scope.history.nextBeforeTimestamp != null) {
        updatesURL += `&before=${this.$scope.history.nextBeforeTimestamp}`
      }
      const labelsURL = `/project/${this.ide.project_id}/labels`

      const requests = { updates: this.ide.$http.get(updatesURL) }

      if (this.$scope.history.labels == null) {
        requests.labels = this.ide.$http.get(labelsURL)
      }

      this.$scope.history.loading = true
      return this.ide.$q
        .all(requests)
        .then(response => {
          this.$scope.history.loading = false
          const updatesData = response.updates.data
          let lastUpdateToV = null

          if (updatesData.updates.length > 0) {
            lastUpdateToV = updatesData.updates[0].toV
          }
          if (response.labels != null) {
            this.$scope.history.labels = this._loadLabels(
              response.labels.data,
              lastUpdateToV
            )
          }
          this._loadUpdates(updatesData.updates)
          this.$scope.history.nextBeforeTimestamp =
            updatesData.nextBeforeTimestamp
          if (
            updatesData.nextBeforeTimestamp == null ||
            this.$scope.history.freeHistoryLimitHit ||
            this.$scope.history.updates.length === 0
          ) {
            this.$scope.history.atEnd = true
          }
          if (this.$scope.history.updates.length === 0) {
            this.$scope.history.loadingFileTree = false
          }
        })
        .catch(error => {
          this.$scope.history.loading = false
          const { status, statusText } = error
          this.$scope.history.error = { status, statusText }
          this.$scope.history.atEnd = true
          this.$scope.history.loadingFileTree = false
        })
    }

    _loadLabels(labels, lastUpdateToV) {
      const sortedLabels = this._sortLabelsByVersionAndDate(labels)
      const labelsWithoutPseudoLabel =
        this._deletePseudoCurrentStateLabelIfExistent(sortedLabels)
      const labelsWithPseudoLabelIfNeeded =
        this._addPseudoCurrentStateLabelIfNeeded(
          labelsWithoutPseudoLabel,
          lastUpdateToV
        )
      return labelsWithPseudoLabelIfNeeded
    }

    _deletePseudoCurrentStateLabelIfExistent(labels) {
      if (labels.length && labels[0].isPseudoCurrentStateLabel) {
        labels.shift()
      }
      return labels
    }

    _addPseudoCurrentStateLabelIfNeeded(labels, mostRecentVersion) {
      if (
        (labels.length && labels[0].version !== mostRecentVersion) ||
        labels.length === 0
      ) {
        const pseudoCurrentStateLabel = {
          id: '1',
          isPseudoCurrentStateLabel: true,
          version: mostRecentVersion,
          created_at: new Date().toISOString(),
        }
        labels.unshift(pseudoCurrentStateLabel)
      }
      return labels
    }

    _sortLabelsByVersionAndDate(labels) {
      return this.ide.$filter('orderBy')(labels, [
        'isPseudoCurrentStateLabel',
        '-version',
        '-created_at',
      ])
    }

    loadFileAtPointInTime() {
      const toV = this.$scope.history.selection.range.toV
      const { pathname } = this.$scope.history.selection
      if (toV == null) {
        return
      }
      let url = `/project/${this.$scope.project_id}/diff`
      const query = [
        `pathname=${encodeURIComponent(pathname)}`,
        `from=${toV}`,
        `to=${toV}`,
      ]
      url += `?${query.join('&')}`
      this.$scope.history.selection.file.loading = true
      return this.ide.$http
        .get(url)
        .then(response => {
          const { text, binary } = this._parseDiff(response.data.diff)
          this.$scope.history.selection.file.binary = binary
          this.$scope.history.selection.file.text = text
          this.$scope.history.selection.file.loading = false
        })
        .catch(function () {})
    }

    reloadDiff() {
      let { diff } = this.$scope.history.selection
      const { range, pathname } = this.$scope.history.selection
      const { fromV, toV } = range

      if (pathname == null) {
        this.$scope.history.selection.diff = null
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

      this.$scope.history.selection.diff = diff = {
        fromV,
        toV,
        pathname,
        error: false,
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
          diff.highlights = highlights
        })
        .catch(function () {
          diff.loading = false
          diff.error = true
        })
    }

    labelCurrentVersion(labelComment) {
      return this._labelVersion(
        labelComment,
        this.$scope.history.selection.range.toV
      )
    }

    deleteLabel(label) {
      const url = `/project/${this.$scope.project_id}/labels/${label.id}`

      return this.ide
        .$http({
          url,
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': window.csrfToken,
          },
        })
        .then(response => {
          return this._deleteLabelLocally(label)
        })
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
      this.$scope.history.labels = this._loadLabels(
        _.filter(
          this.$scope.history.labels,
          label => label.id !== labelToDelete.id
        ),
        this.$scope.history.updates[0].toV
      )
      this._handleHistoryUIStateChange()
    }

    _isLabelSelected(label) {
      if (label) {
        return (
          label.version <= this.$scope.history.selection.range.toV &&
          label.version >= this.$scope.history.selection.range.fromV
        )
      } else {
        return false
      }
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
        let endColumn, endRow
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
            column: startColumn,
          },
          end: {
            row: endRow,
            column: endColumn,
          },
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
              ),
            })
          } else if (entry.d != null) {
            highlights.push({
              label: `Deleted by ${name} on ${date}`,
              strikeThrough: range,
              hue: ColorManager.getHueForUserId(
                user != null ? user.id : undefined
              ),
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
      let previousUpdate =
        this.$scope.history.updates[this.$scope.history.updates.length - 1]
      const dateTimeNow = new Date()
      const timestamp24hoursAgo = dateTimeNow.setDate(dateTimeNow.getDate() - 1)
      let cutOffIndex = null

      const iterable = updates || []
      for (let i = 0; i < iterable.length; i++) {
        const update = iterable[i]
        for (const user of Array.from(update.meta.users || [])) {
          if (user != null) {
            user.hue = ColorManager.getHueForUserId(user.id)
          }
        }
        if (
          previousUpdate == null ||
          !moment(previousUpdate.meta.end_ts).isSame(update.meta.end_ts, 'day')
        ) {
          update.meta.first_in_day = true
        }

        previousUpdate = update

        if (
          !this.$scope.history.userHasFullFeature &&
          update.meta.end_ts < timestamp24hoursAgo
        ) {
          cutOffIndex = i || 1 // Make sure that we show at least one entry (to allow labelling).
          this.$scope.history.freeHistoryLimitHit = true
          if (this.$scope.project.owner._id === this.$scope.user.id) {
            ga(
              'send',
              'event',
              'subscription-funnel',
              'editor-click-feature',
              'history'
            )
            paywallPrompt('history')
          }
          break
        }
      }

      const firstLoad = this.$scope.history.updates.length === 0

      if (!this.$scope.history.userHasFullFeature && cutOffIndex != null) {
        updates = updates.slice(0, cutOffIndex)
      }

      this.$scope.history.updates = this.$scope.history.updates.concat(updates)

      if (firstLoad) {
        this._handleHistoryUIStateChange()
      }
    }

    _labelVersion(comment, version) {
      const url = `/project/${this.$scope.project_id}/labels`
      return this.ide.$http
        .post(url, {
          comment,
          version,
          _csrf: window.csrfToken,
        })
        .then(response => {
          return this._addLabelLocally(response.data)
        })
    }

    _addLabelLocally(label) {
      const localUpdate = _.find(
        this.$scope.history.updates,
        update => update.toV === label.version
      )
      if (localUpdate != null) {
        localUpdate.labels = localUpdate.labels.concat(label)
      }
      this.$scope.history.labels = this._loadLabels(
        this.$scope.history.labels.concat(label),
        this.$scope.history.updates[0].toV
      )
      this._handleHistoryUIStateChange()
    }

    _updateContainsUserId(update, user_id) {
      for (const user of Array.from(update.meta.users)) {
        if ((user != null ? user.id : undefined) === user_id) {
          return true
        }
      }
      return false
    }
  }
  HistoryManager.initClass()
  return HistoryManager
})()

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
