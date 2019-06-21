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
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'base',
  'utils/EventEmitter',
  'ide/colors/ColorManager',
  'ide/review-panel/RangesTracker'
], (App, EventEmitter, ColorManager, RangesTracker) =>
  App.controller('ReviewPanelController', function(
    $scope,
    $element,
    ide,
    $timeout,
    $http,
    $modal,
    event_tracking,
    localStorage
  ) {
    let UserTCSyncState
    const $reviewPanelEl = $element.find('#review-panel')

    const UserTypes = {
      MEMBER: 'member', // Invited, listed in project.members
      GUEST: 'guest', // Not invited, but logged in so has a user_id
      ANONYMOUS: 'anonymous' // No user_id
    }

    const currentUserType = function() {
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
        for (let member of Array.from(project.members)) {
          if (member._id === user_id) {
            return UserTypes.MEMBER
          }
        }
        return UserTypes.GUEST
      }
    }

    $scope.SubViews = {
      CUR_FILE: 'cur_file',
      OVERVIEW: 'overview'
    }

    $scope.UserTCSyncState = UserTCSyncState = {
      SYNCED: 'synced',
      PENDING: 'pending'
    }

    $scope.reviewPanel = {
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
          ) || {}
      },
      dropdown: {
        loading: false
      },
      commentThreads: {},
      resolvedThreadIds: {},
      rendererData: {},
      formattedProjectMembers: {},
      fullTCStateCollapsed: true,
      loadingThreads: false,
      // All selected changes. If a aggregated change (insertion + deletion) is selection, the two ids
      // will be present. The length of this array will differ from the count below (see explanation).
      selectedEntryIds: [],
      // A count of user-facing selected changes. An aggregated change (insertion + deletion) will count
      // as only one.
      nVisibleSelectedChanges: 0
    }

    window.addEventListener('beforeunload', function() {
      const collapsedStates = {}
      for (let doc in $scope.reviewPanel.overview.docsCollapsedState) {
        const state = $scope.reviewPanel.overview.docsCollapsedState[doc]
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
      $scope.$broadcast('review-panel:layout')
    )

    $scope.$on('layout:pdf:resize', (event, state) =>
      $scope.$broadcast('review-panel:layout', false)
    )

    $scope.$on('expandable-text-area:resize', event =>
      $timeout(() => $scope.$broadcast('review-panel:layout'))
    )

    $scope.$on('review-panel:sizes', (e, sizes) =>
      $scope.$broadcast('editor:set-scroll-size', sizes)
    )

    $scope.$watch('project.features.trackChangesVisible', function(visible) {
      if (visible == null) {
        return
      }
      if (!visible) {
        return ($scope.ui.reviewPanelOpen = false)
      }
    })

    $scope.$watch('project.members', function(members) {
      $scope.reviewPanel.formattedProjectMembers = {}
      if (($scope.project != null ? $scope.project.owner : undefined) != null) {
        $scope.reviewPanel.formattedProjectMembers[
          $scope.project.owner._id
        ] = formatUser($scope.project.owner)
      }
      if (
        ($scope.project != null ? $scope.project.members : undefined) != null
      ) {
        return (() => {
          const result = []
          for (let member of Array.from(members)) {
            if (member.privileges === 'readAndWrite') {
              result.push(
                ($scope.reviewPanel.formattedProjectMembers[
                  member._id
                ] = formatUser(member))
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
      content: ''
    }

    $scope.users = {}

    $scope.reviewPanelEventsBridge = new EventEmitter()

    ide.socket.on('new-comment', function(thread_id, comment) {
      const thread = getThread(thread_id)
      delete thread.submitting
      thread.messages.push(formatComment(comment))
      $scope.$apply()
      return $timeout(() => $scope.$broadcast('review-panel:layout'))
    })

    ide.socket.on('accept-changes', function(doc_id, change_ids) {
      if (doc_id !== $scope.editor.open_doc_id) {
        getChangeTracker(doc_id).removeChangeIds(change_ids)
      } else {
        $scope.$broadcast('changes:accept', change_ids)
      }
      updateEntries(doc_id)
      return $scope.$apply(function() {})
    })

    ide.socket.on('resolve-thread', (thread_id, user) =>
      _onCommentResolved(thread_id, user)
    )

    ide.socket.on('reopen-thread', thread_id => _onCommentReopened(thread_id))

    ide.socket.on('delete-thread', function(thread_id) {
      _onThreadDeleted(thread_id)
      return $scope.$apply(function() {})
    })

    ide.socket.on('edit-message', function(thread_id, message_id, content) {
      _onCommentEdited(thread_id, message_id, content)
      return $scope.$apply(function() {})
    })

    ide.socket.on('delete-message', function(thread_id, message_id) {
      _onCommentDeleted(thread_id, message_id)
      return $scope.$apply(function() {})
    })

    const rangesTrackers = {}

    const getDocEntries = function(doc_id) {
      if ($scope.reviewPanel.entries[doc_id] == null) {
        $scope.reviewPanel.entries[doc_id] = {}
      }
      return $scope.reviewPanel.entries[doc_id]
    }

    const getDocResolvedComments = function(doc_id) {
      if ($scope.reviewPanel.resolvedComments[doc_id] == null) {
        $scope.reviewPanel.resolvedComments[doc_id] = {}
      }
      return $scope.reviewPanel.resolvedComments[doc_id]
    }

    var getThread = function(thread_id) {
      if ($scope.reviewPanel.commentThreads[thread_id] == null) {
        $scope.reviewPanel.commentThreads[thread_id] = { messages: [] }
      }
      return $scope.reviewPanel.commentThreads[thread_id]
    }

    var getChangeTracker = function(doc_id) {
      if (rangesTrackers[doc_id] == null) {
        rangesTrackers[doc_id] = new RangesTracker()
        rangesTrackers[doc_id].resolvedThreadIds =
          $scope.reviewPanel.resolvedThreadIds
      }
      return rangesTrackers[doc_id]
    }

    let scrollbar = {}
    $scope.reviewPanelEventsBridge.on('aceScrollbarVisibilityChanged', function(
      isVisible,
      scrollbarWidth
    ) {
      scrollbar = { isVisible, scrollbarWidth }
      return updateScrollbar()
    })

    var updateScrollbar = function() {
      if (
        scrollbar.isVisible &&
        $scope.reviewPanel.subView === $scope.SubViews.CUR_FILE &&
        !$scope.editor.showRichText
      ) {
        return $reviewPanelEl.css('right', `${scrollbar.scrollbarWidth}px`)
      } else {
        return $reviewPanelEl.css('right', '0')
      }
    }

    $scope.$watch('!ui.reviewPanelOpen && reviewPanel.hasEntries', function(
      open,
      prevVal
    ) {
      if (open == null) {
        return
      }
      $scope.ui.miniReviewPanelVisible = open
      if (open !== prevVal) {
        return $timeout(() => $scope.$broadcast('review-panel:toggle'))
      }
    })

    $scope.$watch('ui.reviewPanelOpen', function(open) {
      if (open == null) {
        return
      }
      if (!open) {
        // Always show current file when not open, but save current state
        $scope.reviewPanel.openSubView = $scope.reviewPanel.subView
        $scope.reviewPanel.subView = $scope.SubViews.CUR_FILE
      } else {
        // Reset back to what we had when previously open
        $scope.reviewPanel.subView = $scope.reviewPanel.openSubView
      }
      return $timeout(function() {
        $scope.$broadcast('review-panel:toggle')
        return $scope.$broadcast('review-panel:layout', false)
      })
    })

    $scope.$watch('reviewPanel.subView', function(view) {
      if (view == null) {
        return
      }
      updateScrollbar()
      if (view === $scope.SubViews.OVERVIEW) {
        return refreshOverviewPanel()
      }
    })

    $scope.$watch('editor.sharejs_doc', function(doc, old_doc) {
      if (doc == null) {
        return
      }
      // The open doc range tracker is kept up to date in real-time so
      // replace any outdated info with this
      rangesTrackers[doc.doc_id] = doc.ranges
      rangesTrackers[doc.doc_id].resolvedThreadIds =
        $scope.reviewPanel.resolvedThreadIds
      $scope.reviewPanel.rangesTracker = rangesTrackers[doc.doc_id]
      if (old_doc != null) {
        old_doc.off('flipped_pending_to_inflight')
      }
      doc.on('flipped_pending_to_inflight', () => regenerateTrackChangesId(doc))
      return regenerateTrackChangesId(doc)
    })

    $scope.$watch(
      function() {
        const entries =
          $scope.reviewPanel.entries[$scope.editor.open_doc_id] || {}
        const permEntries = {}
        for (let entry in entries) {
          const entryData = entries[entry]
          if (!['add-comment', 'bulk-actions'].includes(entry)) {
            permEntries[entry] = entryData
          }
        }
        return Object.keys(permEntries).length
      },
      nEntries =>
        ($scope.reviewPanel.hasEntries =
          nEntries > 0 && $scope.project.features.trackChangesVisible)
    )

    var regenerateTrackChangesId = function(doc) {
      const old_id = getChangeTracker(doc.doc_id).getIdSeed()
      const new_id = RangesTracker.generateIdSeed()
      getChangeTracker(doc.doc_id).setIdSeed(new_id)
      return doc.setTrackChangesIdSeeds({ pending: new_id, inflight: old_id })
    }

    const refreshRanges = () =>
      $http
        .get(`/project/${$scope.project_id}/ranges`)
        .then(function(response) {
          const docs = response.data
          return (() => {
            const result = []
            for (let doc of Array.from(docs)) {
              if (
                $scope.reviewPanel.overview.docsCollapsedState[doc.id] == null
              ) {
                $scope.reviewPanel.overview.docsCollapsedState[doc.id] = false
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

    var refreshOverviewPanel = function() {
      $scope.reviewPanel.overview.loading = true
      return refreshRanges()
        .then(() => ($scope.reviewPanel.overview.loading = false))
        .catch(() => ($scope.reviewPanel.overview.loading = false))
    }

    $scope.refreshResolvedCommentsDropdown = function() {
      $scope.reviewPanel.dropdown.loading = true
      const q = refreshRanges()
      q.then(() => ($scope.reviewPanel.dropdown.loading = false))
      q.catch(() => ($scope.reviewPanel.dropdown.loading = false))
      return q
    }

    var updateEntries = function(doc_id) {
      let change, entry_id, key, new_entry, value
      const rangesTracker = getChangeTracker(doc_id)
      const entries = getDocEntries(doc_id)
      const resolvedComments = getDocResolvedComments(doc_id)

      let changed = false

      // Assume we'll delete everything until we see it, then we'll remove it from this object
      const delete_changes = {}
      for (var id in entries) {
        change = entries[id]
        if (!['add-comment', 'bulk-actions'].includes(id)) {
          for (entry_id of Array.from(change.entry_ids)) {
            delete_changes[entry_id] = true
          }
        }
      }
      for (id in resolvedComments) {
        change = resolvedComments[id]
        for (entry_id of Array.from(change.entry_ids)) {
          delete_changes[entry_id] = true
        }
      }

      let potential_aggregate = false
      let prev_insertion = null

      for (change of Array.from(rangesTracker.changes)) {
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
          new_entry = {
            type: change.op.i ? 'insert' : 'delete',
            entry_ids: [change.id],
            content: change.op.i || change.op.d,
            offset: change.op.p,
            metadata: change.metadata
          }
          for (key in new_entry) {
            value = new_entry[key]
            entries[change.id][key] = value
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
          refreshChangeUsers(change.metadata.user_id)
        }
      }

      if (rangesTracker.comments.length > 0) {
        ensureThreadsAreLoaded()
      }

      for (let comment of Array.from(rangesTracker.comments)) {
        var new_comment
        changed = true
        delete delete_changes[comment.id]
        if ($scope.reviewPanel.resolvedThreadIds[comment.op.t]) {
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
        new_entry = {
          type: 'comment',
          thread_id: comment.op.t,
          entry_ids: [comment.id],
          content: comment.op.c,
          offset: comment.op.p
        }
        for (key in new_entry) {
          value = new_entry[key]
          new_comment[key] = value
        }
      }

      for (let change_id in delete_changes) {
        const _ = delete_changes[change_id]
        changed = true
        delete entries[change_id]
        delete resolvedComments[change_id]
      }

      if (changed) {
        return $scope.$broadcast('entries:changed')
      }
    }

    $scope.$on('editor:track-changes:changed', function() {
      const doc_id = $scope.editor.open_doc_id
      updateEntries(doc_id)

      // For now, not worrying about entry panels for rich text
      if (!$scope.editor.showRichText) {
        $scope.$broadcast('review-panel:recalculate-screen-positions')
        return $scope.$broadcast('review-panel:layout')
      }
    })

    $scope.$on('editor:track-changes:visibility_changed', () =>
      $timeout(() => $scope.$broadcast('review-panel:layout', false))
    )

    $scope.$on('editor:focus:changed', function(
      e,
      selection_offset_start,
      selection_offset_end,
      selection
    ) {
      const doc_id = $scope.editor.open_doc_id
      const entries = getDocEntries(doc_id)
      // All selected changes will be added to this array.
      $scope.reviewPanel.selectedEntryIds = []
      // Count of user-visible changes, i.e. an aggregated change will count as one.
      $scope.reviewPanel.nVisibleSelectedChanges = 0
      delete entries['add-comment']
      delete entries['bulk-actions']

      if (selection) {
        entries['add-comment'] = {
          type: 'add-comment',
          offset: selection_offset_start,
          length: selection_offset_end - selection_offset_start
        }
        entries['bulk-actions'] = {
          type: 'bulk-actions',
          offset: selection_offset_start,
          length: selection_offset_end - selection_offset_start
        }
      }

      for (let id in entries) {
        const entry = entries[id]
        let isChangeEntryAndWithinSelection = false
        if (
          entry.type === 'comment' &&
          !$scope.reviewPanel.resolvedThreadIds[entry.thread_id]
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
          for (let entry_id of Array.from(entry.entry_ids)) {
            $scope.reviewPanel.selectedEntryIds.push(entry_id)
          }
          $scope.reviewPanel.nVisibleSelectedChanges++
        }
      }

      $scope.$broadcast('review-panel:recalculate-screen-positions')
      return $scope.$broadcast('review-panel:layout')
    })

    $scope.acceptChanges = function(change_ids) {
      _doAcceptChanges(change_ids)
      return event_tracking.sendMB('rp-changes-accepted', {
        view: $scope.ui.reviewPanelOpen ? $scope.reviewPanel.subView : 'mini'
      })
    }

    $scope.rejectChanges = function(change_ids) {
      _doRejectChanges(change_ids)
      return event_tracking.sendMB('rp-changes-rejected', {
        view: $scope.ui.reviewPanelOpen ? $scope.reviewPanel.subView : 'mini'
      })
    }

    var _doAcceptChanges = function(change_ids) {
      $http.post(
        `/project/${$scope.project_id}/doc/${
          $scope.editor.open_doc_id
        }/changes/accept`,
        { change_ids, _csrf: window.csrfToken }
      )
      return $scope.$broadcast('changes:accept', change_ids)
    }

    var _doRejectChanges = change_ids =>
      $scope.$broadcast('changes:reject', change_ids)

    const bulkAccept = function() {
      _doAcceptChanges($scope.reviewPanel.selectedEntryIds.slice())
      return event_tracking.sendMB('rp-bulk-accept', {
        view: $scope.ui.reviewPanelOpen ? $scope.reviewPanel.subView : 'mini',
        nEntries: $scope.reviewPanel.nVisibleSelectedChanges
      })
    }

    const bulkReject = function() {
      _doRejectChanges($scope.reviewPanel.selectedEntryIds.slice())
      return event_tracking.sendMB('rp-bulk-reject', {
        view: $scope.ui.reviewPanelOpen ? $scope.reviewPanel.subView : 'mini',
        nEntries: $scope.reviewPanel.nVisibleSelectedChanges
      })
    }

    $scope.showBulkAcceptDialog = () => showBulkActionsDialog(true)

    $scope.showBulkRejectDialog = () => showBulkActionsDialog(false)

    var showBulkActionsDialog = isAccept =>
      $modal
        .open({
          templateUrl: 'bulkActionsModalTemplate',
          controller: 'BulkActionsModalController',
          resolve: {
            isAccept() {
              return isAccept
            },
            nChanges() {
              return $scope.reviewPanel.nVisibleSelectedChanges
            }
          },
          scope: $scope.$new()
        })
        .result.then(function(isAccept) {
          if (isAccept) {
            return bulkAccept()
          } else {
            return bulkReject()
          }
        })

    $scope.handleTogglerClick = function(e) {
      e.target.blur()
      return $scope.toggleReviewPanel()
    }

    $scope.addNewComment = function() {
      $scope.$broadcast('comment:start_adding')
      return $scope.toggleReviewPanel()
    }

    $scope.addNewCommentFromKbdShortcut = function() {
      if (!$scope.project.features.trackChangesVisible) {
        return
      }
      $scope.$broadcast('comment:select_line')
      if (!$scope.ui.reviewPanelOpen) {
        $scope.toggleReviewPanel()
      }
      return $timeout(function() {
        $scope.$broadcast('review-panel:layout')
        return $scope.$broadcast('comment:start_adding')
      })
    }

    $scope.startNewComment = function() {
      $scope.$broadcast('comment:select_line')
      return $timeout(() => $scope.$broadcast('review-panel:layout'))
    }

    $scope.submitNewComment = function(content) {
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
      $scope.$broadcast('comment:add', thread_id, offset, length)
      $http
        .post(`/project/${$scope.project_id}/thread/${thread_id}/messages`, {
          content,
          _csrf: window.csrfToken
        })
        .catch(() =>
          ide.showGenericMessageModal(
            'Error submitting comment',
            'Sorry, there was a problem submitting your comment'
          )
        )
      $scope.$broadcast('editor:clearSelection')
      $timeout(() => $scope.$broadcast('review-panel:layout'))
      return event_tracking.sendMB('rp-new-comment', { size: content.length })
    }

    $scope.cancelNewComment = entry =>
      $timeout(() => $scope.$broadcast('review-panel:layout'))

    $scope.startReply = function(entry) {
      entry.replying = true
      return $timeout(() => $scope.$broadcast('review-panel:layout'))
    }

    $scope.submitReply = function(entry, entry_id) {
      const { thread_id } = entry
      const content = entry.replyContent
      $http
        .post(`/project/${$scope.project_id}/thread/${thread_id}/messages`, {
          content,
          _csrf: window.csrfToken
        })
        .catch(() =>
          ide.showGenericMessageModal(
            'Error submitting comment',
            'Sorry, there was a problem submitting your comment'
          )
        )

      const trackingMetadata = {
        view: $scope.ui.reviewPanelOpen ? $scope.reviewPanel.subView : 'mini',
        size: entry.replyContent.length,
        thread: thread_id
      }

      const thread = getThread(thread_id)
      thread.submitting = true
      entry.replyContent = ''
      entry.replying = false
      $timeout(() => $scope.$broadcast('review-panel:layout'))
      return event_tracking.sendMB('rp-comment-reply', trackingMetadata)
    }

    $scope.cancelReply = function(entry) {
      entry.replying = false
      entry.replyContent = ''
      return $scope.$broadcast('review-panel:layout')
    }

    $scope.resolveComment = function(entry, entry_id) {
      entry.focused = false
      $http.post(
        `/project/${$scope.project_id}/thread/${entry.thread_id}/resolve`,
        { _csrf: window.csrfToken }
      )
      _onCommentResolved(entry.thread_id, ide.$scope.user)
      return event_tracking.sendMB('rp-comment-resolve', {
        view: $scope.ui.reviewPanelOpen ? $scope.reviewPanel.subView : 'mini'
      })
    }

    $scope.unresolveComment = function(thread_id) {
      _onCommentReopened(thread_id)
      $http.post(`/project/${$scope.project_id}/thread/${thread_id}/reopen`, {
        _csrf: window.csrfToken
      })
      return event_tracking.sendMB('rp-comment-reopen')
    }

    var _onCommentResolved = function(thread_id, user) {
      const thread = getThread(thread_id)
      if (thread == null) {
        return
      }
      thread.resolved = true
      thread.resolved_by_user = formatUser(user)
      thread.resolved_at = new Date().toISOString()
      $scope.reviewPanel.resolvedThreadIds[thread_id] = true
      return $scope.$broadcast('comment:resolve_threads', [thread_id])
    }

    var _onCommentReopened = function(thread_id) {
      const thread = getThread(thread_id)
      if (thread == null) {
        return
      }
      delete thread.resolved
      delete thread.resolved_by_user
      delete thread.resolved_at
      delete $scope.reviewPanel.resolvedThreadIds[thread_id]
      return $scope.$broadcast('comment:unresolve_thread', thread_id)
    }

    var _onThreadDeleted = function(thread_id) {
      delete $scope.reviewPanel.resolvedThreadIds[thread_id]
      delete $scope.reviewPanel.commentThreads[thread_id]
      return $scope.$broadcast('comment:remove', thread_id)
    }

    var _onCommentEdited = function(thread_id, comment_id, content) {
      const thread = getThread(thread_id)
      if (thread == null) {
        return
      }
      for (let message of Array.from(thread.messages)) {
        if (message.id === comment_id) {
          message.content = content
        }
      }
      return updateEntries()
    }

    var _onCommentDeleted = function(thread_id, comment_id) {
      const thread = getThread(thread_id)
      if (thread == null) {
        return
      }
      thread.messages = thread.messages.filter(m => m.id !== comment_id)
      return updateEntries()
    }

    $scope.deleteThread = function(entry_id, doc_id, thread_id) {
      _onThreadDeleted(thread_id)
      $http({
        method: 'DELETE',
        url: `/project/${$scope.project_id}/doc/${doc_id}/thread/${thread_id}`,
        headers: {
          'X-CSRF-Token': window.csrfToken
        }
      })
      return event_tracking.sendMB('rp-comment-delete')
    }

    $scope.saveEdit = function(thread_id, comment) {
      $http.post(
        `/project/${$scope.project_id}/thread/${thread_id}/messages/${
          comment.id
        }/edit`,
        {
          content: comment.content,
          _csrf: window.csrfToken
        }
      )
      return $timeout(() => $scope.$broadcast('review-panel:layout'))
    }

    $scope.deleteComment = function(thread_id, comment) {
      _onCommentDeleted(thread_id, comment.id)
      $http({
        method: 'DELETE',
        url: `/project/${$scope.project_id}/thread/${thread_id}/messages/${
          comment.id
        }`,
        headers: {
          'X-CSRF-Token': window.csrfToken
        }
      })
      return $timeout(() => $scope.$broadcast('review-panel:layout'))
    }

    $scope.setSubView = function(subView) {
      $scope.reviewPanel.subView = subView
      return event_tracking.sendMB('rp-subview-change', { subView })
    }

    $scope.gotoEntry = (doc_id, entry) =>
      ide.editorManager.openDocId(doc_id, { gotoOffset: entry.offset })

    $scope.toggleFullTCStateCollapse = function() {
      if ($scope.project.features.trackChanges) {
        return ($scope.reviewPanel.fullTCStateCollapsed = !$scope.reviewPanel
          .fullTCStateCollapsed)
      } else {
        _sendAnalytics()
        return $scope.openTrackChangesUpgradeModal()
      }
    }

    const _sendAnalytics = () => {
      event_tracking.send(
        'subscription-funnel',
        'editor-click-feature',
        'real-time-track-changes'
      )
    }

    const _setUserTCState = function(userId, newValue, isLocal) {
      if (isLocal == null) {
        isLocal = false
      }
      if ($scope.reviewPanel.trackChangesState[userId] == null) {
        $scope.reviewPanel.trackChangesState[userId] = {}
      }
      const state = $scope.reviewPanel.trackChangesState[userId]

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

    const _setEveryoneTCState = function(newValue, isLocal) {
      if (isLocal == null) {
        isLocal = false
      }
      $scope.reviewPanel.trackChangesOnForEveryone = newValue
      const { project } = $scope
      for (let member of Array.from(project.members)) {
        _setUserTCState(member._id, newValue, isLocal)
      }
      _setGuestsTCState(newValue, isLocal)
      return _setUserTCState(project.owner._id, newValue, isLocal)
    }

    var _setGuestsTCState = function(newValue, isLocal) {
      if (isLocal == null) {
        isLocal = false
      }
      $scope.reviewPanel.trackChangesOnForGuests = newValue
      if (
        currentUserType() === UserTypes.GUEST ||
        currentUserType() === UserTypes.ANONYMOUS
      ) {
        return ($scope.editor.wantTrackChanges = newValue)
      }
    }

    const applyClientTrackChangesStateToServer = function() {
      const data = {}
      if ($scope.reviewPanel.trackChangesOnForEveryone) {
        data.on = true
      } else {
        data.on_for = {}
        for (let userId in $scope.reviewPanel.trackChangesState) {
          const userState = $scope.reviewPanel.trackChangesState[userId]
          data.on_for[userId] = userState.value
        }
        if ($scope.reviewPanel.trackChangesOnForGuests) {
          data.on_for_guests = true
        }
      }
      data._csrf = window.csrfToken
      return $http.post(`/project/${$scope.project_id}/track_changes`, data)
    }

    const applyTrackChangesStateToClient = function(state) {
      if (typeof state === 'boolean') {
        _setEveryoneTCState(state)
        return _setGuestsTCState(state)
      } else {
        const { project } = $scope
        $scope.reviewPanel.trackChangesOnForEveryone = false
        _setGuestsTCState(state.__guests__ === true)
        for (let member of Array.from(project.members)) {
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

    $scope.toggleTrackChangesForEveryone = function(onForEveryone) {
      _setEveryoneTCState(onForEveryone, true)
      _setGuestsTCState(onForEveryone, true)
      return applyClientTrackChangesStateToServer()
    }

    $scope.toggleTrackChangesForGuests = function(onForGuests) {
      _setGuestsTCState(onForGuests, true)
      return applyClientTrackChangesStateToServer()
    }

    $scope.toggleTrackChangesForUser = function(onForUser, userId) {
      _setUserTCState(userId, onForUser, true)
      return applyClientTrackChangesStateToServer()
    }

    ide.socket.on('toggle-track-changes', state =>
      $scope.$apply(() => applyTrackChangesStateToClient(state))
    )

    $scope.toggleTrackChangesFromKbdShortcut = function() {
      if (
        !(
          $scope.project.features.trackChangesVisible &&
          $scope.project.features.trackChanges
        )
      ) {
        return
      }
      return $scope.toggleTrackChangesForUser(
        !$scope.reviewPanel.trackChangesState[ide.$scope.user.id].value,
        ide.$scope.user.id
      )
    }

    const setGuestFeatureBasedOnProjectAccessLevel = projectPublicAccessLevel =>
      ($scope.reviewPanel.trackChangesForGuestsAvailable =
        projectPublicAccessLevel === 'tokenBased')

    const onToggleTrackChangesForGuestsAvailability = function(available) {
      // If the feature is no longer available we need to turn off the guest flag
      if (available) {
        return
      }
      if (!$scope.reviewPanel.trackChangesOnForGuests) {
        return
      } // Already turned off
      if ($scope.reviewPanel.trackChangesOnForEveryone) {
        return
      } // Overrides guest setting
      return $scope.toggleTrackChangesForGuests(false)
    }

    $scope.$watch(
      'project.publicAccesLevel',
      setGuestFeatureBasedOnProjectAccessLevel
    )

    $scope.$watch('reviewPanel.trackChangesForGuestsAvailable', function(
      available
    ) {
      if (available != null) {
        return onToggleTrackChangesForGuestsAvailability(available)
      }
    })

    let _inited = false
    ide.$scope.$on('project:joined', function() {
      if (_inited) {
        return
      }
      const { project } = ide.$scope
      if (project.features.trackChanges) {
        if (window.trackChangesState == null) {
          window.trackChangesState = false
        }
        applyTrackChangesStateToClient(window.trackChangesState)
      } else {
        applyTrackChangesStateToClient(false)
      }
      setGuestFeatureBasedOnProjectAccessLevel(project.publicAccesLevel)
      return (_inited = true)
    })

    let _refreshingRangeUsers = false
    const _refreshedForUserIds = {}
    var refreshChangeUsers = function(refresh_for_user_id) {
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
        .then(function(response) {
          const users = response.data
          _refreshingRangeUsers = false
          $scope.users = {}
          // Always include ourself, since if we submit an op, we might need to display info
          // about it locally before it has been flushed through the server
          if (
            (ide.$scope.user != null ? ide.$scope.user.id : undefined) != null
          ) {
            $scope.users[ide.$scope.user.id] = formatUser(ide.$scope.user)
          }
          return (() => {
            const result = []
            for (let user of Array.from(users)) {
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

    let _threadsLoaded = false
    var ensureThreadsAreLoaded = function() {
      if (_threadsLoaded) {
        // We get any updates in real time so only need to load them once.
        return
      }
      _threadsLoaded = true
      $scope.reviewPanel.loadingThreads = true
      return $http
        .get(`/project/${$scope.project_id}/threads`)
        .then(function(response) {
          const threads = response.data
          $scope.reviewPanel.loadingThreads = false
          for (var thread_id in $scope.reviewPanel.resolvedThreadIds) {
            const _ = $scope.reviewPanel.resolvedThreadIds[thread_id]
            delete $scope.reviewPanel.resolvedThreadIds[thread_id]
          }
          for (thread_id in threads) {
            const thread = threads[thread_id]
            for (let comment of Array.from(thread.messages)) {
              formatComment(comment)
            }
            if (thread.resolved_by_user != null) {
              thread.resolved_by_user = formatUser(thread.resolved_by_user)
              $scope.reviewPanel.resolvedThreadIds[thread_id] = true
              $scope.$broadcast('comment:resolve_threads', [thread_id])
            }
          }
          $scope.reviewPanel.commentThreads = threads
          return $timeout(() => $scope.$broadcast('review-panel:layout'))
        })
    }

    var formatComment = function(comment) {
      comment.user = formatUser(comment.user)
      comment.timestamp = new Date(comment.timestamp)
      return comment
    }

    var formatUser = function(user) {
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
          avatar_text: 'A'
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
          .join('')
      }
    }

    return ($scope.openTrackChangesUpgradeModal = () =>
      $modal.open({
        templateUrl: 'trackChangesUpgradeModalTemplate',
        controller: 'TrackChangesUpgradeModalController',
        scope: $scope.$new()
      }))
  }))
