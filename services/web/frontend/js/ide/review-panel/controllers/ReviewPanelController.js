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
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import RangesTracker from '@overleaf/ranges-tracker'
import App from '../../../base'
import EventEmitter from '../../../utils/EventEmitter'
import ColorManager from '../../colors/ColorManager'
import getMeta from '../../../utils/meta'

export default App.controller('ReviewPanelController', [
  '$scope',
  '$element',
  'ide',
  '$timeout',
  '$http',
  '$modal',
  'eventTracking',
  'localStorage',
  function (
    $scope,
    $element,
    ide,
    $timeout,
    $http,
    $modal,
    eventTracking,
    localStorage
  ) {
    let UserTCSyncState
    const $reviewPanelEl = $element.find('#review-panel')

    const UserTypes = {
      MEMBER: 'member', // Invited, listed in project.members
      GUEST: 'guest', // Not invited, but logged in so has a user_id
      ANONYMOUS: 'anonymous', // No user_id
    }

    const currentUserType = function () {
      if ((ide.$scope.user != null ? ide.$scope.user.id : undefined) == null) {
        return UserTypes.ANONYMOUS
      } else {
        const user_id = ide.$scope.user.id
        const { project } = ide.$scope
        if (
          (project.owner != null ? project.owner.id : undefined) === user_id
        ) {
          return UserTypes.MEMBER
        }
        for (const member of Array.from(project.members)) {
          if (member._id === user_id) {
            return UserTypes.MEMBER
          }
        }
        return UserTypes.GUEST
      }
    }

    $scope.SubViews = {
      CUR_FILE: 'cur_file',
      OVERVIEW: 'overview',
    }

    $scope.UserTCSyncState = UserTCSyncState = {
      SYNCED: 'synced',
      PENDING: 'pending',
    }

    ide.$scope.reviewPanel = {
      trackChangesState: {},
      trackChangesOnForEveryone: false,
      trackChangesOnForGuests: false,
      trackChangesForGuestsAvailable: false,
      entries: {},
      resolvedComments: {},
      hasEntries: false,
      subView: $scope.SubViews.CUR_FILE,
      openSubView: $scope.SubViews.CUR_FILE,
      overview: {
        loading: false,
        docsCollapsedState:
          JSON.parse(
            localStorage(`docs_collapsed_state:${$scope.project_id}`)
          ) || {},
      },
      dropdown: {
        loading: false,
      },
      commentThreads: {},
      resolvedThreadIds: {},
      layoutToLeft: false,
      rendererData: {},
      formattedProjectMembers: {},
      fullTCStateCollapsed: true,
      // All selected changes. If a aggregated change (insertion + deletion) is selection, the two ids
      // will be present. The length of this array will differ from the count below (see explanation).
      selectedEntryIds: [],
      // A count of user-facing selected changes. An aggregated change (insertion + deletion) will count
      // as only one.
      nVisibleSelectedChanges: 0,
      entryHover: false,
    }

    ide.$scope.loadingThreads = true

    window.addEventListener('beforeunload', function () {
      const collapsedStates = {}
      for (const doc in ide.$scope.reviewPanel.overview.docsCollapsedState) {
        const state = ide.$scope.reviewPanel.overview.docsCollapsedState[doc]
        if (state) {
          collapsedStates[doc] = state
        }
      }
      const valToStore =
        Object.keys(collapsedStates).length > 0
          ? JSON.stringify(collapsedStates)
          : null
      return localStorage(
        `docs_collapsed_state:${$scope.project_id}`,
        valToStore
      )
    })

    $scope.$on('layout:pdf:linked', (event, state) =>
      ide.$scope.$broadcast('review-panel:layout')
    )

    $scope.$on('layout:pdf:resize', (event, state) => {
      ide.$scope.reviewPanel.layoutToLeft =
        state.east?.size < 220 || state.east?.initClosed
      ide.$scope.$broadcast('review-panel:layout', false)
    })

    $scope.$on('review-panel:sizes', (e, sizes) => {
      $scope.$broadcast('editor:set-scroll-size', sizes)
      dispatchReviewPanelEvent('sizes', sizes)
    })

    $scope.$watch('project.features.trackChangesVisible', function (visible) {
      if (visible == null) {
        return
      }
      if (!visible) {
        return ($scope.ui.reviewPanelOpen = false)
      }
    })

    $scope.$watch('project.members', function (members) {
      ide.$scope.reviewPanel.formattedProjectMembers = {}
      if (($scope.project != null ? $scope.project.owner : undefined) != null) {
        ide.$scope.reviewPanel.formattedProjectMembers[
          $scope.project.owner._id
        ] = formatUser($scope.project.owner)
      }
      if (
        ($scope.project != null ? $scope.project.members : undefined) != null
      ) {
        return (() => {
          const result = []
          for (const member of Array.from(members)) {
            if (member.privileges === 'readAndWrite') {
              if (
                ide.$scope.reviewPanel.trackChangesState[member._id] == null
              ) {
                // An added member will have track changes enabled if track changes is on for everyone
                _setUserTCState(
                  member._id,
                  ide.$scope.reviewPanel.trackChangesOnForEveryone,
                  true
                )
              }
              result.push(
                (ide.$scope.reviewPanel.formattedProjectMembers[member._id] =
                  formatUser(member))
              )
            } else {
              result.push(undefined)
            }
          }
          return result
        })()
      }
    })

    $scope.commentState = {
      adding: false,
      content: '',
    }

    ide.$scope.users = $scope.users = {}

    ide.$scope.reviewPanelEventsBridge = new EventEmitter()

    ide.socket.on('new-comment', function (thread_id, comment) {
      const thread = getThread(thread_id)
      delete thread.submitting
      thread.messages.push(formatComment(comment))
      $scope.$apply()
      return $timeout(() => ide.$scope.$broadcast('review-panel:layout'))
    })

    ide.socket.on('accept-changes', function (doc_id, change_ids) {
      if (doc_id !== $scope.editor.open_doc_id) {
        getChangeTracker(doc_id).removeChangeIds(change_ids)
      } else {
        $scope.$broadcast('changes:accept', change_ids)
        dispatchReviewPanelEvent('changes:accept', change_ids)
      }
      updateEntries(doc_id)
      return $scope.$apply(function () {})
    })

    ide.socket.on('resolve-thread', (thread_id, user) =>
      _onCommentResolved(thread_id, user)
    )

    ide.socket.on('reopen-thread', thread_id => _onCommentReopened(thread_id))

    ide.socket.on('delete-thread', function (thread_id) {
      _onThreadDeleted(thread_id)
      return $scope.$apply(function () {})
    })

    ide.socket.on('edit-message', function (thread_id, message_id, content) {
      _onCommentEdited(thread_id, message_id, content)
      return $scope.$apply(function () {})
    })

    ide.socket.on('delete-message', function (thread_id, message_id) {
      _onCommentDeleted(thread_id, message_id)
      return $scope.$apply(function () {})
    })

    const rangesTrackers = {}

    const getDocEntries = function (doc_id) {
      if (ide.$scope.reviewPanel.entries[doc_id] == null) {
        ide.$scope.reviewPanel.entries[doc_id] = {}
      }
      return ide.$scope.reviewPanel.entries[doc_id]
    }

    const getDocResolvedComments = function (doc_id) {
      if (ide.$scope.reviewPanel.resolvedComments[doc_id] == null) {
        ide.$scope.reviewPanel.resolvedComments[doc_id] = {}
      }
      return ide.$scope.reviewPanel.resolvedComments[doc_id]
    }

    function getThread(thread_id) {
      if (ide.$scope.reviewPanel.commentThreads[thread_id] == null) {
        ide.$scope.reviewPanel.commentThreads[thread_id] = { messages: [] }
      }
      return ide.$scope.reviewPanel.commentThreads[thread_id]
    }

    function getChangeTracker(doc_id) {
      if (rangesTrackers[doc_id] == null) {
        rangesTrackers[doc_id] = new RangesTracker()
        rangesTrackers[doc_id].resolvedThreadIds =
          ide.$scope.reviewPanel.resolvedThreadIds
      }
      return rangesTrackers[doc_id]
    }

    $scope.$watch(
      '!ui.reviewPanelOpen && reviewPanel.hasEntries',
      function (open, prevVal) {
        if (open == null) {
          return
        }
        $scope.ui.miniReviewPanelVisible = open
        if (open !== prevVal) {
          return $timeout(() => $scope.$broadcast('review-panel:toggle'))
        }
      }
    )

    $scope.$watch('ui.reviewPanelOpen', function (open) {
      if (open == null) {
        return
      }
      if (!open) {
        // Always show current file when not open, but save current state
        ide.$scope.reviewPanel.openSubView = ide.$scope.reviewPanel.subView
        ide.$scope.reviewPanel.subView = $scope.SubViews.CUR_FILE
      } else {
        // Reset back to what we had when previously open
        ide.$scope.reviewPanel.subView = ide.$scope.reviewPanel.openSubView
      }
      return $timeout(function () {
        $scope.$broadcast('review-panel:toggle')
        return ide.$scope.$broadcast('review-panel:layout', false)
      })
    })

    $scope.$watch('reviewPanel.subView', function (view, oldView) {
      if (view == null) {
        return
      }
      if (view === $scope.SubViews.OVERVIEW) {
        return refreshOverviewPanel()
      } else if (oldView === $scope.SubViews.OVERVIEW) {
        dispatchReviewPanelEvent('overview-closed', view)
      }
    })

    $scope.$watch('editor.sharejs_doc', function (doc, old_doc) {
      if (doc == null) {
        return
      }
      // The open doc range tracker is kept up to date in real-time so
      // replace any outdated info with this
      rangesTrackers[doc.doc_id] = doc.ranges
      rangesTrackers[doc.doc_id].resolvedThreadIds =
        ide.$scope.reviewPanel.resolvedThreadIds
      ide.$scope.reviewPanel.rangesTracker = rangesTrackers[doc.doc_id]
      if (old_doc != null) {
        old_doc.off('flipped_pending_to_inflight')
      }
      doc.on('flipped_pending_to_inflight', () => regenerateTrackChangesId(doc))
      return regenerateTrackChangesId(doc)
    })

    $scope.$watch(
      function () {
        const entries =
          ide.$scope.reviewPanel.entries[$scope.editor.open_doc_id] || {}
        const permEntries = {}
        for (const entry in entries) {
          const entryData = entries[entry]
          if (!['add-comment', 'bulk-actions'].includes(entry)) {
            permEntries[entry] = entryData
          }
        }
        return Object.keys(permEntries).length
      },
      nEntries =>
        (ide.$scope.reviewPanel.hasEntries =
          nEntries > 0 && $scope.project.features.trackChangesVisible)
    )

    function regenerateTrackChangesId(doc) {
      const old_id = getChangeTracker(doc.doc_id).getIdSeed()
      const new_id = RangesTracker.generateIdSeed()
      getChangeTracker(doc.doc_id).setIdSeed(new_id)
      return doc.setTrackChangesIdSeeds({ pending: new_id, inflight: old_id })
    }

    const refreshRanges = () =>
      $http
        .get(`/project/${$scope.project_id}/ranges`)
        .then(function (response) {
          const docs = response.data
          return (() => {
            const result = []
            for (const doc of Array.from(docs)) {
              if (
                ide.$scope.reviewPanel.overview.docsCollapsedState[doc.id] ==
                null
              ) {
                ide.$scope.reviewPanel.overview.docsCollapsedState[
                  doc.id
                ] = false
              }
              if (doc.id !== $scope.editor.open_doc_id) {
                // this is kept up to date in real-time, don't overwrite
                const rangesTracker = getChangeTracker(doc.id)
                rangesTracker.comments =
                  (doc.ranges != null ? doc.ranges.comments : undefined) || []
                rangesTracker.changes =
                  (doc.ranges != null ? doc.ranges.changes : undefined) || []
              }
              result.push(updateEntries(doc.id))
            }
            return result
          })()
        })

    function refreshOverviewPanel() {
      ide.$scope.reviewPanel.overview.loading = true
      return refreshRanges()
        .then(() => (ide.$scope.reviewPanel.overview.loading = false))
        .catch(() => (ide.$scope.reviewPanel.overview.loading = false))
    }

    ide.$scope.refreshResolvedCommentsDropdown = function () {
      ide.$scope.reviewPanel.dropdown.loading = true
      const q = refreshRanges()
      q.then(() => (ide.$scope.reviewPanel.dropdown.loading = false))
      q.catch(() => (ide.$scope.reviewPanel.dropdown.loading = false))
      return q
    }

    async function updateEntries(doc_id) {
      const rangesTracker = getChangeTracker(doc_id)
      const entries = getDocEntries(doc_id)
      const resolvedComments = getDocResolvedComments(doc_id)

      let changed = false

      // Assume we'll delete everything until we see it, then we'll remove it from this object
      const delete_changes = {}
      for (const id in entries) {
        const change = entries[id]
        if (!['add-comment', 'bulk-actions'].includes(id)) {
          for (const entry_id of Array.from(change.entry_ids)) {
            delete_changes[entry_id] = true
          }
        }
      }
      for (const id in resolvedComments) {
        const change = resolvedComments[id]
        for (const entry_id of Array.from(change.entry_ids)) {
          delete_changes[entry_id] = true
        }
      }

      let potential_aggregate = false
      let prev_insertion = null

      for (const change of Array.from(rangesTracker.changes)) {
        changed = true

        if (
          potential_aggregate &&
          change.op.d &&
          change.op.p === prev_insertion.op.p + prev_insertion.op.i.length &&
          change.metadata.user_id === prev_insertion.metadata.user_id
        ) {
          // An actual aggregate op.
          entries[prev_insertion.id].type = 'aggregate-change'
          entries[prev_insertion.id].metadata.replaced_content = change.op.d
          entries[prev_insertion.id].entry_ids.push(change.id)
        } else {
          if (entries[change.id] == null) {
            entries[change.id] = {}
          }
          delete delete_changes[change.id]
          const new_entry = {
            type: change.op.i ? 'insert' : 'delete',
            entry_ids: [change.id],
            content: change.op.i || change.op.d,
            offset: change.op.p,
            metadata: change.metadata,
          }
          for (const key in new_entry) {
            entries[change.id][key] = new_entry[key]
          }
        }

        if (change.op.i) {
          potential_aggregate = true
          prev_insertion = change
        } else {
          potential_aggregate = false
          prev_insertion = null
        }

        if ($scope.users[change.metadata.user_id] == null) {
          if (!window.isRestrictedTokenMember) {
            refreshChangeUsers(change.metadata.user_id)
          }
        }
      }

      if (!window.isRestrictedTokenMember) {
        if (rangesTracker.comments.length > 0) {
          await ensureThreadsAreLoaded()
        } else if (ide.$scope.loadingThreads === true) {
          // ensure that tracked changes are highlighted even if no comments are loaded
          ide.$scope.loadingThreads = false
          dispatchReviewPanelEvent('loaded_threads')
        }
      }

      if (!_loadingThreadsInProgress) {
        for (const comment of Array.from(rangesTracker.comments)) {
          let new_comment
          changed = true
          delete delete_changes[comment.id]
          if (ide.$scope.reviewPanel.resolvedThreadIds[comment.op.t]) {
            new_comment =
              resolvedComments[comment.id] != null
                ? resolvedComments[comment.id]
                : (resolvedComments[comment.id] = {})
            delete entries[comment.id]
          } else {
            new_comment =
              entries[comment.id] != null
                ? entries[comment.id]
                : (entries[comment.id] = {})
            delete resolvedComments[comment.id]
          }
          const new_entry = {
            type: 'comment',
            thread_id: comment.op.t,
            entry_ids: [comment.id],
            content: comment.op.c,
            offset: comment.op.p,
          }
          for (const key in new_entry) {
            new_comment[key] = new_entry[key]
          }
        }
      }

      for (const change_id in delete_changes) {
        const _ = delete_changes[change_id]
        changed = true
        delete entries[change_id]
        delete resolvedComments[change_id]
      }

      if (changed) {
        // TODO: unused?
        $scope.$broadcast('entries:changed')
      }

      return entries
    }

    $scope.$on('editor:track-changes:changed', async function () {
      const doc_id = $scope.editor.open_doc_id
      const entries = await updateEntries(doc_id)

      $scope.$broadcast('review-panel:recalculate-screen-positions')
      dispatchReviewPanelEvent('recalculate-screen-positions', {
        entries,
        updateType: 'trackedChangesChange',
      })

      // Ensure that watchers, such as the React-based review panel component,
      // are informed of the changes to entries
      ide.$scope.$apply()

      return ide.$scope.$broadcast('review-panel:layout')
    })

    $scope.$on('editor:track-changes:visibility_changed', () =>
      $timeout(() => ide.$scope.$broadcast('review-panel:layout', false))
    )

    $scope.$on(
      'editor:focus:changed',
      function (
        e,
        selection_offset_start,
        selection_offset_end,
        selection,
        updateType = null
      ) {
        const doc_id = $scope.editor.open_doc_id
        const entries = getDocEntries(doc_id)
        // All selected changes will be added to this array.
        ide.$scope.reviewPanel.selectedEntryIds = []
        // Count of user-visible changes, i.e. an aggregated change will count as one.
        ide.$scope.reviewPanel.nVisibleSelectedChanges = 0

        const offset = selection_offset_start
        const length = selection_offset_end - selection_offset_start

        // Recreate the add comment and bulk actions entries only when
        // necessary. This is to avoid the UI thinking that these entries have
        // changed and getting into an infinite loop.
        if (selection) {
          const existingAddComment = entries['add-comment']
          if (
            !existingAddComment ||
            existingAddComment.offset !== offset ||
            existingAddComment.length !== length
          ) {
            entries['add-comment'] = {
              type: 'add-comment',
              offset,
              length,
            }
          }
          const existingBulkActions = entries['bulk-actions']
          if (
            !existingBulkActions ||
            existingBulkActions.offset !== offset ||
            existingBulkActions.length !== length
          ) {
            entries['bulk-actions'] = {
              type: 'bulk-actions',
              offset,
              length,
            }
          }
        } else {
          delete entries['add-comment']
          delete entries['bulk-actions']
        }

        for (const id in entries) {
          const entry = entries[id]
          let isChangeEntryAndWithinSelection = false
          if (
            entry.type === 'comment' &&
            !ide.$scope.reviewPanel.resolvedThreadIds[entry.thread_id]
          ) {
            entry.focused =
              entry.offset <= selection_offset_start &&
              selection_offset_start <= entry.offset + entry.content.length
          } else if (entry.type === 'insert') {
            isChangeEntryAndWithinSelection =
              entry.offset >= selection_offset_start &&
              entry.offset + entry.content.length <= selection_offset_end
            entry.focused =
              entry.offset <= selection_offset_start &&
              selection_offset_start <= entry.offset + entry.content.length
          } else if (entry.type === 'delete') {
            isChangeEntryAndWithinSelection =
              selection_offset_start <= entry.offset &&
              entry.offset <= selection_offset_end
            entry.focused = entry.offset === selection_offset_start
          } else if (entry.type === 'aggregate-change') {
            isChangeEntryAndWithinSelection =
              entry.offset >= selection_offset_start &&
              entry.offset + entry.content.length <= selection_offset_end
            entry.focused =
              entry.offset <= selection_offset_start &&
              selection_offset_start <= entry.offset + entry.content.length
          } else if (
            ['add-comment', 'bulk-actions'].includes(entry.type) &&
            selection
          ) {
            entry.focused = true
          }

          if (isChangeEntryAndWithinSelection) {
            for (const entry_id of Array.from(entry.entry_ids)) {
              ide.$scope.reviewPanel.selectedEntryIds.push(entry_id)
            }
            ide.$scope.reviewPanel.nVisibleSelectedChanges++
          }
        }

        $scope.$broadcast('review-panel:recalculate-screen-positions')

        dispatchReviewPanelEvent('recalculate-screen-positions', {
          entries,
          updateType,
        })

        // Ensure that watchers, such as the React-based review panel component,
        // are informed of the changes to entries
        ide.$scope.$apply()

        return ide.$scope.$broadcast('review-panel:layout')
      }
    )

    ide.$scope.acceptChanges = function (change_ids) {
      _doAcceptChanges(change_ids)
      eventTracking.sendMB('rp-changes-accepted', {
        view: $scope.ui.reviewPanelOpen
          ? ide.$scope.reviewPanel.subView
          : 'mini',
      })
    }

    ide.$scope.rejectChanges = function (change_ids) {
      _doRejectChanges(change_ids)
      eventTracking.sendMB('rp-changes-rejected', {
        view: $scope.ui.reviewPanelOpen
          ? ide.$scope.reviewPanel.subView
          : 'mini',
      })
    }

    // The next two functions control a class on the review panel that affects
    // the overflow-y rule on the panel. This is necessary so that an entry in
    // the review panel is visible when hovering over its indicator when the
    // review panel is minimized. See issue #8057.
    $scope.mouseEnterIndicator = function () {
      ide.$scope.reviewPanel.entryHover = true
    }

    $scope.mouseLeaveIndicator = function () {
      ide.$scope.reviewPanel.entryHover = false
    }

    function _doAcceptChanges(change_ids) {
      $http.post(
        `/project/${$scope.project_id}/doc/${$scope.editor.open_doc_id}/changes/accept`,
        { change_ids, _csrf: window.csrfToken }
      )
      $scope.$broadcast('changes:accept', change_ids)
      dispatchReviewPanelEvent('changes:accept', change_ids)
    }

    const _doRejectChanges = change_ids => {
      $scope.$broadcast('changes:reject', change_ids)
      dispatchReviewPanelEvent('changes:reject', change_ids)
    }

    ide.$scope.bulkAcceptActions = function () {
      _doAcceptChanges(ide.$scope.reviewPanel.selectedEntryIds.slice())
      eventTracking.sendMB('rp-bulk-accept', {
        view: $scope.ui.reviewPanelOpen
          ? ide.$scope.reviewPanel.subView
          : 'mini',
        nEntries: ide.$scope.reviewPanel.nVisibleSelectedChanges,
      })
    }

    ide.$scope.bulkRejectActions = function () {
      _doRejectChanges(ide.$scope.reviewPanel.selectedEntryIds.slice())
      eventTracking.sendMB('rp-bulk-reject', {
        view: $scope.ui.reviewPanelOpen
          ? ide.$scope.reviewPanel.subView
          : 'mini',
        nEntries: ide.$scope.reviewPanel.nVisibleSelectedChanges,
      })
    }

    ide.$scope.addNewComment = function (e) {
      e.preventDefault()
      ide.$scope.$broadcast('comment:start_adding')
      return $scope.toggleReviewPanel()
    }

    $scope.addNewCommentFromKbdShortcut = function () {
      if (!$scope.project.features.trackChangesVisible) {
        return
      }
      $scope.$broadcast('comment:select_line')
      dispatchReviewPanelEvent('comment:select_line')

      if (!$scope.ui.reviewPanelOpen) {
        $scope.toggleReviewPanel()
      }
      return $timeout(function () {
        ide.$scope.$broadcast('review-panel:layout')
        ide.$scope.$broadcast('comment:start_adding')
      })
    }

    $scope.startNewComment = function () {
      $scope.$broadcast('comment:select_line')
      dispatchReviewPanelEvent('comment:select_line')
      return $timeout(() => ide.$scope.$broadcast('review-panel:layout'))
    }

    ide.$scope.submitNewComment = function (content) {
      if (content == null || content === '') {
        return
      }
      const doc_id = $scope.editor.open_doc_id
      const entries = getDocEntries(doc_id)
      if (entries['add-comment'] == null) {
        return
      }
      const { offset, length } = entries['add-comment']
      const thread_id = RangesTracker.generateId()
      const thread = getThread(thread_id)
      thread.submitting = true

      const emitCommentAdd = () => {
        $scope.$broadcast('comment:add', thread_id, offset, length)
        dispatchReviewPanelEvent('comment:add', {
          threadId: thread_id,
          offset,
          length,
        })

        // TODO: unused?
        $scope.$broadcast('editor:clearSelection')
        $timeout(() => ide.$scope.$broadcast('review-panel:layout'))
        eventTracking.sendMB('rp-new-comment', { size: content.length })
      }

      return $http
        .post(`/project/${$scope.project_id}/thread/${thread_id}/messages`, {
          content,
          _csrf: window.csrfToken,
        })
        .then(() => {
          emitCommentAdd()
        })
        .catch(() => {
          ide.showGenericMessageModal(
            'Error submitting comment',
            'Sorry, there was a problem submitting your comment'
          )
          throw Error('Error submitting comment')
        })
    }

    $scope.cancelNewComment = entry =>
      $timeout(() => ide.$scope.$broadcast('review-panel:layout'))

    $scope.startReply = function (entry) {
      entry.replying = true
      return $timeout(() => ide.$scope.$broadcast('review-panel:layout'))
    }

    ide.$scope.submitReply = function (entry, entry_id) {
      const { thread_id } = entry
      const content = entry.replyContent
      $http
        .post(`/project/${$scope.project_id}/thread/${thread_id}/messages`, {
          content,
          _csrf: window.csrfToken,
        })
        .catch(() =>
          ide.showGenericMessageModal(
            'Error submitting comment',
            'Sorry, there was a problem submitting your comment'
          )
        )

      const trackingMetadata = {
        view: $scope.ui.reviewPanelOpen
          ? ide.$scope.reviewPanel.subView
          : 'mini',
        size: entry.replyContent.length,
        thread: thread_id,
      }

      const thread = getThread(thread_id)
      thread.submitting = true
      entry.replyContent = ''
      entry.replying = false
      $timeout(() => ide.$scope.$broadcast('review-panel:layout'))
      eventTracking.sendMB('rp-comment-reply', trackingMetadata)
    }

    $scope.cancelReply = function (entry) {
      entry.replying = false
      entry.replyContent = ''
      return ide.$scope.$broadcast('review-panel:layout')
    }

    ide.$scope.resolveComment = function (doc_id, entry_id) {
      const entry = getDocEntries(doc_id)[entry_id]
      entry.focused = false
      $http.post(
        `/project/${$scope.project_id}/thread/${entry.thread_id}/resolve`,
        { _csrf: window.csrfToken }
      )
      _onCommentResolved(entry.thread_id, ide.$scope.user)
      eventTracking.sendMB('rp-comment-resolve', {
        view: $scope.ui.reviewPanelOpen
          ? ide.$scope.reviewPanel.subView
          : 'mini',
      })
    }

    ide.$scope.unresolveComment = function (thread_id) {
      _onCommentReopened(thread_id)
      $http.post(`/project/${$scope.project_id}/thread/${thread_id}/reopen`, {
        _csrf: window.csrfToken,
      })
      eventTracking.sendMB('rp-comment-reopen')
    }

    function _onCommentResolved(thread_id, user) {
      const thread = getThread(thread_id)
      if (thread == null) {
        return
      }
      thread.resolved = true
      thread.resolved_by_user = formatUser(user)
      thread.resolved_at = new Date().toISOString()
      ide.$scope.reviewPanel.resolvedThreadIds[thread_id] = true
      $scope.$broadcast('comment:resolve_threads', [thread_id])
      dispatchReviewPanelEvent('comment:resolve_threads', [thread_id])
    }

    function _onCommentReopened(thread_id) {
      const thread = getThread(thread_id)
      if (thread == null) {
        return
      }
      delete thread.resolved
      delete thread.resolved_by_user
      delete thread.resolved_at
      delete ide.$scope.reviewPanel.resolvedThreadIds[thread_id]
      $scope.$broadcast('comment:unresolve_thread', thread_id)
      dispatchReviewPanelEvent('comment:unresolve_thread', thread_id)
    }

    function _onThreadDeleted(thread_id) {
      delete ide.$scope.reviewPanel.resolvedThreadIds[thread_id]
      delete ide.$scope.reviewPanel.commentThreads[thread_id]
      $scope.$broadcast('comment:remove', thread_id)
      dispatchReviewPanelEvent('comment:remove', thread_id)
    }

    function _onCommentEdited(thread_id, comment_id, content) {
      const thread = getThread(thread_id)
      if (thread == null) {
        return
      }
      for (const message of Array.from(thread.messages)) {
        if (message.id === comment_id) {
          message.content = content
        }
      }
      return updateEntries()
    }

    function _onCommentDeleted(thread_id, comment_id) {
      const thread = getThread(thread_id)
      if (thread == null) {
        return
      }
      thread.messages = thread.messages.filter(m => m.id !== comment_id)
      return updateEntries()
    }

    ide.$scope.deleteThread = function (entry_id, doc_id, thread_id) {
      _onThreadDeleted(thread_id)
      $http({
        method: 'DELETE',
        url: `/project/${$scope.project_id}/doc/${doc_id}/thread/${thread_id}`,
        headers: {
          'X-CSRF-Token': window.csrfToken,
        },
      })
      eventTracking.sendMB('rp-comment-delete')
    }

    ide.$scope.saveEdit = function (thread_id, comment_id, content) {
      $http.post(
        `/project/${$scope.project_id}/thread/${thread_id}/messages/${comment_id}/edit`,
        {
          content,
          _csrf: window.csrfToken,
        }
      )
      return $timeout(() => ide.$scope.$broadcast('review-panel:layout'))
    }

    ide.$scope.deleteComment = function (thread_id, comment_id) {
      _onCommentDeleted(thread_id, comment_id)
      $http({
        method: 'DELETE',
        url: `/project/${$scope.project_id}/thread/${thread_id}/messages/${comment_id}`,
        headers: {
          'X-CSRF-Token': window.csrfToken,
        },
      })
      return $timeout(() => ide.$scope.$broadcast('review-panel:layout'))
    }

    $scope.setSubView = function (subView) {
      ide.$scope.reviewPanel.subView = subView
      eventTracking.sendMB('rp-subview-change', { subView })
    }

    ide.$scope.gotoEntry = (doc_id, entry_offset) =>
      ide.editorManager.openDocId(doc_id, { gotoOffset: entry_offset })

    const _setUserTCState = function (userId, newValue, isLocal) {
      if (isLocal == null) {
        isLocal = false
      }
      if (ide.$scope.reviewPanel.trackChangesState[userId] == null) {
        ide.$scope.reviewPanel.trackChangesState[userId] = {}
      }
      const state = ide.$scope.reviewPanel.trackChangesState[userId]

      if (
        state.syncState == null ||
        state.syncState === UserTCSyncState.SYNCED
      ) {
        state.value = newValue
        state.syncState = UserTCSyncState.SYNCED
      } else if (
        state.syncState === UserTCSyncState.PENDING &&
        state.value === newValue
      ) {
        state.syncState = UserTCSyncState.SYNCED
      } else if (isLocal) {
        state.value = newValue
        state.syncState = UserTCSyncState.PENDING
      }
      if (userId === ide.$scope.user.id) {
        return ($scope.editor.wantTrackChanges = newValue)
      }
    }

    const _setEveryoneTCState = function (newValue, isLocal) {
      if (isLocal == null) {
        isLocal = false
      }
      ide.$scope.reviewPanel.trackChangesOnForEveryone = newValue
      const { project } = $scope
      for (const member of Array.from(project.members)) {
        _setUserTCState(member._id, newValue, isLocal)
      }
      _setGuestsTCState(newValue, isLocal)
      return _setUserTCState(project.owner._id, newValue, isLocal)
    }

    function _setGuestsTCState(newValue, isLocal) {
      if (isLocal == null) {
        isLocal = false
      }
      ide.$scope.reviewPanel.trackChangesOnForGuests = newValue
      if (
        currentUserType() === UserTypes.GUEST ||
        currentUserType() === UserTypes.ANONYMOUS
      ) {
        return ($scope.editor.wantTrackChanges = newValue)
      }
    }

    const applyClientTrackChangesStateToServer = function () {
      ide.$scope.reviewPanel.trackChangesState = {
        ...ide.$scope.reviewPanel.trackChangesState,
      }
      const data = {}
      if (ide.$scope.reviewPanel.trackChangesOnForEveryone) {
        data.on = true
      } else {
        data.on_for = {}
        for (const userId in ide.$scope.reviewPanel.trackChangesState) {
          const userState = ide.$scope.reviewPanel.trackChangesState[userId]
          data.on_for[userId] = userState.value
        }
        if (ide.$scope.reviewPanel.trackChangesOnForGuests) {
          data.on_for_guests = true
        }
      }
      data._csrf = window.csrfToken
      return $http.post(`/project/${$scope.project_id}/track_changes`, data)
    }

    const applyTrackChangesStateToClient = function (state) {
      if (typeof state === 'boolean') {
        _setEveryoneTCState(state)
        return _setGuestsTCState(state)
      } else {
        const { project } = $scope
        ide.$scope.reviewPanel.trackChangesOnForEveryone = false
        _setGuestsTCState(state.__guests__ === true)
        for (const member of Array.from(project.members)) {
          _setUserTCState(
            member._id,
            state[member._id] != null ? state[member._id] : false
          )
        }
        return _setUserTCState(
          $scope.project.owner._id,
          state[$scope.project.owner._id] != null
            ? state[$scope.project.owner._id]
            : false
        )
      }
    }

    ide.$scope.toggleTrackChangesForEveryone = function (onForEveryone) {
      _setEveryoneTCState(onForEveryone, true)
      _setGuestsTCState(onForEveryone, true)
      return applyClientTrackChangesStateToServer()
    }

    ide.$scope.toggleTrackChangesForGuests = function (onForGuests) {
      _setGuestsTCState(onForGuests, true)
      return applyClientTrackChangesStateToServer()
    }

    ide.$scope.toggleTrackChangesForUser = function (onForUser, userId) {
      _setUserTCState(userId, onForUser, true)
      return applyClientTrackChangesStateToServer()
    }

    ide.socket.on('toggle-track-changes', state =>
      $scope.$apply(() => applyTrackChangesStateToClient(state))
    )

    $scope.toggleTrackChangesFromKbdShortcut = function () {
      if (
        !(
          $scope.project.features.trackChangesVisible &&
          $scope.project.features.trackChanges
        )
      ) {
        return
      }
      return $scope.toggleTrackChangesForUser(
        !ide.$scope.reviewPanel.trackChangesState[ide.$scope.user.id].value,
        ide.$scope.user.id
      )
    }

    const setGuestFeatureBasedOnProjectAccessLevel = projectPublicAccessLevel =>
      (ide.$scope.reviewPanel.trackChangesForGuestsAvailable =
        projectPublicAccessLevel === 'tokenBased')

    const onToggleTrackChangesForGuestsAvailability = function (available) {
      // If the feature is no longer available we need to turn off the guest flag
      if (available) {
        return
      }
      if (!ide.$scope.reviewPanel.trackChangesOnForGuests) {
        return
      } // Already turned off
      if (ide.$scope.reviewPanel.trackChangesOnForEveryone) {
        return
      } // Overrides guest setting
      return $scope.toggleTrackChangesForGuests(false)
    }

    $scope.$watch(
      'project.publicAccesLevel',
      setGuestFeatureBasedOnProjectAccessLevel
    )

    $scope.$watch(
      'reviewPanel.trackChangesForGuestsAvailable',
      function (available) {
        if (available != null) {
          return onToggleTrackChangesForGuestsAvailability(available)
        }
      }
    )

    let _inited = false
    ide.$scope.$on('project:joined', function () {
      if (_inited) {
        return
      }
      const { project } = ide.$scope
      if (project.features.trackChanges) {
        applyTrackChangesStateToClient(project.trackChangesState)
      } else {
        applyTrackChangesStateToClient(false)
      }
      setGuestFeatureBasedOnProjectAccessLevel(project.publicAccesLevel)
      return (_inited = true)
    })

    let _refreshingRangeUsers = false
    const _refreshedForUserIds = {}
    function refreshChangeUsers(refresh_for_user_id) {
      if (refresh_for_user_id != null) {
        if (_refreshedForUserIds[refresh_for_user_id] != null) {
          // We've already tried to refresh to get this user id, so stop it looping
          return
        }
        _refreshedForUserIds[refresh_for_user_id] = true
      }

      // Only do one refresh at once
      if (_refreshingRangeUsers) {
        return
      }
      _refreshingRangeUsers = true

      return $http
        .get(`/project/${$scope.project_id}/changes/users`)
        .then(function (response) {
          const users = response.data
          _refreshingRangeUsers = false
          ide.$scope.users = $scope.users = {}
          // Always include ourself, since if we submit an op, we might need to display info
          // about it locally before it has been flushed through the server
          if (
            (ide.$scope.user != null ? ide.$scope.user.id : undefined) != null
          ) {
            $scope.users[ide.$scope.user.id] = formatUser(ide.$scope.user)
          }
          return (() => {
            const result = []
            for (const user of Array.from(users)) {
              if (user.id != null) {
                result.push(($scope.users[user.id] = formatUser(user)))
              } else {
                result.push(undefined)
              }
            }
            return result
          })()
        })
        .catch(() => (_refreshingRangeUsers = false))
    }

    let _threadsLoadedOnce = false
    let _loadingThreadsInProgress = false
    async function ensureThreadsAreLoaded() {
      if (_threadsLoadedOnce) {
        // We get any updates in real time so only need to load them once.
        return
      }
      _threadsLoadedOnce = true
      _loadingThreadsInProgress = true
      ide.$scope.loadingThreads = true
      return $http
        .get(`/project/${$scope.project_id}/threads`)
        .then(async function (response) {
          const threads = response.data
          ide.$scope.loadingThreads = false
          _loadingThreadsInProgress = false
          for (const thread_id in ide.$scope.reviewPanel.resolvedThreadIds) {
            delete ide.$scope.reviewPanel.resolvedThreadIds[thread_id]
          }
          for (const thread_id in threads) {
            const thread = threads[thread_id]
            for (const comment of Array.from(thread.messages)) {
              formatComment(comment)
            }
            if (thread.resolved_by_user != null) {
              thread.resolved_by_user = formatUser(thread.resolved_by_user)
              ide.$scope.reviewPanel.resolvedThreadIds[thread_id] = true
              $scope.$broadcast('comment:resolve_threads', [thread_id])
            }
          }
          ide.$scope.reviewPanel.commentThreads = threads
          // Update entries so that the view has up-to-date information about
          // the entries when handling the loaded_threads events, which avoids
          // thrashing
          await updateEntries($scope.editor.open_doc_id)

          dispatchReviewPanelEvent('loaded_threads')
          return $timeout(() => ide.$scope.$broadcast('review-panel:layout'))
        })
    }

    function formatComment(comment) {
      comment.user = formatUser(comment.user)
      comment.timestamp = new Date(comment.timestamp)
      return comment
    }

    function formatUser(user) {
      let isSelf, name
      const id =
        (user != null ? user._id : undefined) ||
        (user != null ? user.id : undefined)

      if (id == null) {
        return {
          email: null,
          name: 'Anonymous',
          isSelf: false,
          hue: ColorManager.ANONYMOUS_HUE,
          avatar_text: 'A',
        }
      }
      if (id === window.user_id) {
        name = 'You'
        isSelf = true
      } else {
        name = [user.first_name, user.last_name]
          .filter(n => n != null && n !== '')
          .join(' ')
        if (name === '') {
          name =
            (user.email != null ? user.email.split('@')[0] : undefined) ||
            'Unknown'
        }
        isSelf = false
      }
      return {
        id,
        email: user.email,
        name,
        isSelf,
        hue: ColorManager.getHueForUserId(id),
        avatar_text: [user.first_name, user.last_name]
          .filter(n => n != null)
          .map(n => n[0])
          .join(''),
      }
    }

    // listen for events from the CodeMirror 6 track changes extension
    window.addEventListener('editor:event', event => {
      const { type, payload } = event.detail

      switch (type) {
        case 'line-height': {
          ide.$scope.reviewPanel.rendererData.lineHeight = payload
          ide.$scope.$broadcast('review-panel:layout')
          break
        }

        case 'track-changes:changed': {
          $scope.$broadcast('editor:track-changes:changed')
          break
        }

        case 'track-changes:visibility_changed': {
          $scope.$broadcast('editor:track-changes:visibility_changed')
          break
        }

        case 'focus:changed': {
          const { from, to, empty, updateType } = payload
          $scope.$broadcast(
            'editor:focus:changed',
            from,
            to,
            !empty,
            updateType
          )
          break
        }

        case 'add-new-comment': {
          $scope.addNewCommentFromKbdShortcut()
          break
        }

        case 'toggle-track-changes': {
          $scope.toggleTrackChangesFromKbdShortcut()
          break
        }

        case 'toggle-review-panel': {
          $scope.toggleReviewPanel()
          break
        }
      }
    })

    // Add methods somewhere that React can see them
    $scope.reviewPanel.saveEdit = $scope.saveEdit
  },
])

// send events to the CodeMirror 6 track changes extension
const dispatchReviewPanelEvent = (type, payload) => {
  window.dispatchEvent(
    new CustomEvent('review-panel:event', {
      detail: { type, payload },
    })
  )
}
