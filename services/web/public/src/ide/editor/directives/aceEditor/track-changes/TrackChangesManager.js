/* eslint-disable
    camelcase,
    max-len
 */
define([
  'ace/ace',
  'utils/EventEmitter',
  'ide/colors/ColorManager',
  'ide/editor/EditorShareJsCodec'
], function(_ignore, EventEmitter, ColorManager, EditorShareJsCodec) {
  const { Range } = ace.require('ace/range')
  class TrackChangesManager {
    constructor($scope, editor, element, adapter) {
      this._doneUpdateThisLoop = false
      this._pendingUpdates = false

      this.onChangeSession = this.onChangeSession.bind(this)
      this.onChangeSelection = this.onChangeSelection.bind(this)
      this.onCut = this.onCut.bind(this)
      this.onPaste = this.onPaste.bind(this)
      this.onResize = this.onResize.bind(this)
      this.tearDown = this.tearDown.bind(this)

      this.$scope = $scope
      this.editor = editor
      this.element = element
      this.adapter = adapter
      this._scrollTimeout = null
      this.changingSelection = false

      if (window.trackChangesManager == null) {
        window.trackChangesManager = this
      }

      this.$scope.$watch('trackChanges', track_changes => {
        if (track_changes == null) {
          return
        }
        this.setTrackChanges(track_changes)
      })

      this.$scope.$watch('sharejsDoc', (doc, oldDoc) => {
        if (doc == null) {
          return
        }
        if (oldDoc != null) {
          this.disconnectFromDoc(oldDoc)
        }
        this.setTrackChanges(this.$scope.trackChanges)
        this.connectToDoc(doc)
      })

      this.$scope.$on('comment:add', (e, thread_id, offset, length) => {
        this.addCommentToSelection(thread_id, offset, length)
      })

      this.$scope.$on('comment:select_line', e => {
        this.selectLineIfNoSelection()
      })

      this.$scope.$on('changes:accept', (e, change_ids) => {
        this.acceptChangeIds(change_ids)
      })

      this.$scope.$on('changes:reject', (e, change_ids) => {
        this.rejectChangeIds(change_ids)
      })

      this.$scope.$on('comment:remove', (e, comment_id) => {
        this.removeCommentId(comment_id)
      })

      this.$scope.$on('comment:resolve_threads', (e, thread_ids) => {
        this.hideCommentsByThreadIds(thread_ids)
      })

      this.$scope.$on('comment:unresolve_thread', (e, thread_id) => {
        this.showCommentByThreadId(thread_id)
      })

      this.$scope.$on('review-panel:recalculate-screen-positions', () => {
        this.recalculateReviewEntriesScreenPositions()
      })

      this._resetCutState()
    }

    onChangeSession(e) {
      this.clearAnnotations()
      this.redrawAnnotations()

      if (this.editor) {
        this.editor.session.on(
          'changeScrollTop',
          this.onChangeScroll.bind(this)
        )
      }
    }

    onChangeScroll() {
      if (this._scrollTimeout != null) {
      } else {
        return (this._scrollTimeout = setTimeout(() => {
          this.recalculateVisibleEntries()
          this.$scope.$apply()
          return (this._scrollTimeout = null)
        }, 200))
      }
    }

    onChangeSelection() {
      // Deletes can send about 5 changeSelection events, so
      // just act on the last one.
      if (!this.changingSelection) {
        this.changingSelection = true
        return this.$scope.$evalAsync(() => {
          this.changingSelection = false
          return this.updateFocus()
        })
      }
    }

    onResize() {
      this.recalculateReviewEntriesScreenPositions()
    }

    connectToDoc(doc) {
      this.rangesTracker = doc.ranges
      this.setTrackChanges(this.$scope.trackChanges)

      doc.on('ranges:dirty', () => {
        this.updateAnnotations()
      })
      doc.on('ranges:clear', () => {
        this.clearAnnotations()
      })
      doc.on('ranges:redraw', () => {
        this.redrawAnnotations()
      })
    }

    disconnectFromDoc(doc) {
      doc.off('ranges:clear')
      doc.off('ranges:redraw')
      doc.off('ranges:dirty')
    }

    tearDown() {
      this.adapter.tearDown()
    }

    setTrackChanges(value) {
      if (value) {
        if (this.$scope.sharejsDoc != null) {
          this.$scope.sharejsDoc.track_changes_as =
            window.user.id || 'anonymous'
        }
      } else {
        if (this.$scope.sharejsDoc != null) {
          this.$scope.sharejsDoc.track_changes_as = null
        }
      }
    }

    clearAnnotations() {
      this.adapter.clearAnnotations()
    }

    redrawAnnotations() {
      for (let change of Array.from(this.rangesTracker.changes)) {
        if (change.op.i != null) {
          this.adapter.onInsertAdded(change)
        } else if (change.op.d != null) {
          this.adapter.onDeleteAdded(change)
        }
      }

      Array.from(this.rangesTracker.comments).map(comment => {
        if (!this.isCommentResolved(comment)) {
          this.adapter.onCommentAdded(comment)
        }
      })

      this.broadcastChange()
    }

    updateAnnotations() {
      // Doc updates with multiple ops, like search/replace or block comments
      // will call this with every individual op in a single event loop. So only
      // do the first this loop, then schedule an update for the next loop for
      // the rest.
      if (!this._doneUpdateThisLoop) {
        this._doUpdateAnnotations()
        this._doneUpdateThisLoop = true
        return setTimeout(() => {
          if (this._pendingUpdates) {
            this._doUpdateAnnotations()
          }
          this._doneUpdateThisLoop = false
          this._pendingUpdates = false
        })
      } else {
        this._pendingUpdates = true
      }
    }

    _doUpdateAnnotations() {
      let change, comment
      const dirty = this.rangesTracker.getDirtyState()

      let updateMarkers = false

      for (var id in dirty.change.added) {
        change = dirty.change.added[id]
        if (change.op.i != null) {
          this.adapter.onInsertAdded(change)
        } else if (change.op.d != null) {
          this.adapter.onDeleteAdded(change)
        }
      }
      for (id in dirty.change.removed) {
        change = dirty.change.removed[id]
        if (change.op.i != null) {
          this.adapter.onInsertRemoved(change)
        } else if (change.op.d != null) {
          this.adapter.onDeleteRemoved(change)
        }
      }
      for (id in dirty.change.moved) {
        change = dirty.change.moved[id]
        updateMarkers = true
        this.adapter.onChangeMoved(change)
      }

      for (id in dirty.comment.added) {
        comment = dirty.comment.added[id]
        if (!this.isCommentResolved(comment)) {
          this.adapter.onCommentAdded(comment)
        }
      }
      for (id in dirty.comment.removed) {
        comment = dirty.comment.removed[id]
        if (!this.isCommentResolved(comment)) {
          this.adapter.onCommentRemoved(comment)
        }
      }
      for (id in dirty.comment.moved) {
        comment = dirty.comment.moved[id]
        if (this.adapter.onCommentMoved && !this.isCommentResolved(comment)) {
          updateMarkers = true
          this.adapter.onCommentMoved(comment)
        }
      }

      /**
       * For now, if not using ACE don't worry about the markers
       */
      if (!this.editor) {
        updateMarkers = false
      }

      this.rangesTracker.resetDirtyState()
      if (updateMarkers) {
        this.editor.renderer.updateBackMarkers()
      }
      this.broadcastChange()
    }

    addComment(offset, content, thread_id) {
      const op = { c: content, p: offset, t: thread_id }
      // @rangesTracker.applyOp op # Will apply via sharejs
      this.$scope.sharejsDoc.submitOp(op)
    }

    addCommentToSelection(thread_id, offset, length) {
      const start = this.adapter.shareJsOffsetToRowColumn(offset)
      const end = this.adapter.shareJsOffsetToRowColumn(offset + length)
      const range = new Range(start.row, start.column, end.row, end.column)
      const content = this.editor.session.getTextRange(range)
      this.addComment(offset, content, thread_id)
    }

    isCommentResolved(comment) {
      return this.rangesTracker.resolvedThreadIds[comment.op.t]
    }

    selectLineIfNoSelection() {
      if (this.editor.selection.isEmpty()) {
        this.editor.selection.selectLine()
      }
    }

    acceptChangeIds(change_ids) {
      this.rangesTracker.removeChangeIds(change_ids)
      this.updateAnnotations()
      this.updateFocus()
    }

    rejectChangeIds(change_ids) {
      const changes = this.rangesTracker.getChanges(change_ids)
      if (changes.length === 0) {
        return
      }

      // When doing bulk rejections, adjacent changes might interact with each other.
      // Consider an insertion with an adjacent deletion (which is a common use-case, replacing words):
      //
      //     "foo bar baz" -> "foo quux baz"
      //
      // The change above will be modeled with two ops, with the insertion going first:
      //
      //     foo quux baz
      //         |--| -> insertion of "quux", op 1, at position 4
      //             | -> deletion of "bar", op 2, pushed forward by "quux" to position 8
      //
      // When rejecting these changes at once, if the insertion is rejected first, we get unexpected
      // results. What happens is:
      //
      //     1) Rejecting the insertion deletes the added word "quux", i.e., it removes 4 chars
      //        starting from position 4;
      //
      //           "foo quux baz" -> "foo  baz"
      //                |--| -> 4 characters to be removed
      //
      //     2) Rejecting the deletion adds the deleted word "bar" at position 8 (i.e. it will act as if
      //        the word "quuux" was still present).
      //
      //            "foo  baz" -> "foo  bazbar"
      //                     | -> deletion of "bar" is reverted by reinserting "bar" at position 8
      //
      // While the intended result would be "foo bar baz", what we get is:
      //
      //      "foo  bazbar" (note "bar" readded at position 8)
      //
      // The issue happens because of step 1. To revert the insertion of "quux", 4 characters are deleted
      // from position 4. This includes the position where the deletion exists; when that position is
      // cleared, the RangesTracker considers that the deletion is gone and stops tracking/updating it.
      // As we still hold a reference to it, the code tries to revert it by readding the deleted text, but
      // does so at the outdated position (position 8, which was valid when "quux" was present).
      //
      // To avoid this kind of problem, we need to make sure that reverting operations doesn't affect
      // subsequent operations that come after. Reverse sorting the operations based on position will
      // achieve it; in the case above, it makes sure that the the deletion is reverted first:
      //
      //     1) Rejecting the deletion adds the deleted word "bar" at position 8
      //
      //            "foo quux baz" -> "foo quuxbar baz"
      //                                       | -> deletion of "bar" is reverted by
      //                                            reinserting "bar" at position 8
      //
      //     2) Rejecting the insertion deletes the added word "quux", i.e., it removes 4 chars
      //        starting from position 4 and achieves the expected result:
      //
      //           "foo quuxbar baz" -> "foo bar baz"
      //                |--| -> 4 characters to be removed

      changes.sort((a, b) => b.op.p - a.op.p)

      const session = this.editor.getSession()
      for (let change of Array.from(changes)) {
        if (change.op.d != null) {
          const content = change.op.d
          const position = this.adapter.shareJsOffsetToRowColumn(change.op.p)
          session.$fromReject = true // Tell track changes to cancel out delete
          session.insert(position, content)
          session.$fromReject = false
        } else if (change.op.i != null) {
          const start = this.adapter.shareJsOffsetToRowColumn(change.op.p)
          const end = this.adapter.shareJsOffsetToRowColumn(
            change.op.p + change.op.i.length
          )
          const editor_text = session.getDocument().getTextRange({ start, end })
          if (editor_text !== change.op.i) {
            throw new Error(
              `Op to be removed (${JSON.stringify(
                change.op
              )}), does not match editor text, '${editor_text}'`
            )
          }
          session.$fromReject = true
          session.remove({ start, end })
          session.$fromReject = false
        } else {
          throw new Error(`unknown change: ${JSON.stringify(change)}`)
        }
      }
      setTimeout(() => this.updateFocus())
    }

    removeCommentId(comment_id) {
      this.rangesTracker.removeCommentId(comment_id)
      return this.updateAnnotations()
    }

    hideCommentsByThreadIds(thread_ids) {
      const resolve_ids = {}
      let comments = this.rangesTracker.comments || []
      for (let id of Array.from(thread_ids)) {
        resolve_ids[id] = true
      }

      for (let comment of comments) {
        if (resolve_ids[comment.op.t]) {
          this.adapter.onCommentRemoved(comment)
        }
      }
      return this.broadcastChange()
    }

    showCommentByThreadId(thread_id) {
      let comments = this.rangesTracker.comments || []
      for (let comment of comments) {
        if (comment.op.t === thread_id && !this.isCommentResolved(comment)) {
          this.adapter.onCommentAdded(comment)
        }
      }
      return this.broadcastChange()
    }

    _resetCutState() {
      return (this._cutState = {
        text: null,
        comments: [],
        docId: null
      })
    }

    onCut() {
      this._resetCutState()
      const selection = this.editor.getSelectionRange()
      const selection_start = this._rangeToShareJs(selection.start)
      const selection_end = this._rangeToShareJs(selection.end)
      this._cutState.text = this.editor.getSelectedText()
      this._cutState.docId = this.$scope.docId
      return (() => {
        const result = []
        for (let comment of Array.from(this.rangesTracker.comments)) {
          const comment_start = comment.op.p
          const comment_end = comment_start + comment.op.c.length
          if (
            selection_start <= comment_start &&
            comment_end <= selection_end
          ) {
            result.push(
              this._cutState.comments.push({
                offset: comment.op.p - selection_start,
                text: comment.op.c,
                comment
              })
            )
          } else {
            result.push(undefined)
          }
        }
        return result
      })()
    }

    onPaste() {
      this.editor.once('change', change => {
        if (change.action !== 'insert') {
          return
        }
        const pasted_text = change.lines.join('\n')
        const paste_offset = this._rangeToShareJs(change.start)
        // We have to wait until the change has been processed by the range
        // tracker, since if we move the ops into place beforehand, they will be
        // moved again when the changes are processed by the range tracker. This
        // ranges:dirty event is fired after the doc has applied the changes to
        // the range tracker.
        this.$scope.sharejsDoc.on('ranges:dirty.paste', () => {
          // Doc event emitter uses namespaced events
          this.$scope.sharejsDoc.off('ranges:dirty.paste')
          if (
            pasted_text === this._cutState.text &&
            this.$scope.docId === this._cutState.docId
          ) {
            for (let { comment, offset, text } of Array.from(
              this._cutState.comments
            )) {
              const op = { c: text, p: paste_offset + offset, t: comment.id }
              this.$scope.sharejsDoc.submitOp(op)
            } // Resubmitting an existing comment op (by thread id) will move it
          }
          this._resetCutState()
          // Check that comments still match text. Will throw error if not.
          this.rangesTracker.validate(this.editor.getValue())
        })
      })
    }

    checkMapping() {
      // TODO: reintroduce this check
      let background_marker_id, callout_marker_id, end, marker, op, start
      const session = this.editor.getSession()

      // Make a copy of session.getMarkers() so we can modify it
      const markers = {}
      const object = session.getMarkers()
      for (var marker_id in object) {
        marker = object[marker_id]
        markers[marker_id] = marker
      }

      const expected_markers = []
      for (var change of Array.from(this.rangesTracker.changes)) {
        if (this.adapter.changeIdToMarkerIdMap[change.id] != null) {
          ;({ op } = change)
          ;({
            background_marker_id,
            callout_marker_id
          } = this.adapter.changeIdToMarkerIdMap[change.id])
          start = this.adapter.shareJsOffsetToRowColumn(op.p)
          if (op.i != null) {
            end = this.adapter.shareJsOffsetToRowColumn(op.p + op.i.length)
          } else if (op.d != null) {
            end = start
          }
          expected_markers.push({
            marker_id: background_marker_id,
            start,
            end
          })
          expected_markers.push({
            marker_id: callout_marker_id,
            start,
            end: start
          })
        }
      }

      for (let comment of Array.from(this.rangesTracker.comments)) {
        if (this.adapter.changeIdToMarkerIdMap[comment.id] != null) {
          ;({
            background_marker_id,
            callout_marker_id
          } = this.adapter.changeIdToMarkerIdMap[comment.id])
          start = this.adapter.shareJsOffsetToRowColumn(comment.op.p)
          end = this.adapter.shareJsOffsetToRowColumn(
            comment.op.p + comment.op.c.length
          )
          expected_markers.push({
            marker_id: background_marker_id,
            start,
            end
          })
          expected_markers.push({
            marker_id: callout_marker_id,
            start,
            end: start
          })
        }
      }

      for ({ marker_id, start, end } of Array.from(expected_markers)) {
        marker = markers[marker_id]
        delete markers[marker_id]
        if (
          marker.range.start.row !== start.row ||
          marker.range.start.column !== start.column ||
          marker.range.end.row !== end.row ||
          marker.range.end.column !== end.column
        ) {
          console.error("Change doesn't match marker anymore", {
            change,
            marker,
            start,
            end
          })
        }
      }

      return (() => {
        const result = []
        for (marker_id in markers) {
          marker = markers[marker_id]
          if (/track-changes/.test(marker.clazz)) {
            result.push(console.error('Orphaned ace marker', marker))
          } else {
            result.push(undefined)
          }
        }
        return result
      })()
    }

    broadcastChange() {
      this.$scope.$emit('editor:track-changes:changed', this.$scope.docId)
    }

    recalculateReviewEntriesScreenPositions() {
      const session = this.editor.getSession()
      const { renderer } = this.editor
      const entries = this._getCurrentDocEntries()
      const object = entries || {}
      for (let entry_id in object) {
        const entry = object[entry_id]
        const doc_position = this.adapter.shareJsOffsetToRowColumn(entry.offset)
        const screen_position = session.documentToScreenPosition(
          doc_position.row,
          doc_position.column
        )
        const y = screen_position.row * renderer.lineHeight
        if (entry.screenPos == null) {
          entry.screenPos = {}
        }
        entry.screenPos.y = y
        entry.docPos = doc_position
      }
      this.recalculateVisibleEntries()
      this.$scope.$apply()
    }

    recalculateVisibleEntries() {
      const OFFSCREEN_ROWS = 20

      // With less than this number of entries, don't bother culling to avoid
      // little UI jumps when scrolling.
      const CULL_AFTER = 100

      const { firstRow, lastRow } = this.editor.renderer.layerConfig
      const entries = this._getCurrentDocEntries() || {}
      const entriesLength = Object.keys(entries).length
      let changed = false
      for (let entry_id in entries) {
        const entry = entries[entry_id]
        const old = entry.visible
        entry.visible =
          entriesLength < CULL_AFTER ||
          (firstRow - OFFSCREEN_ROWS <= entry.docPos.row &&
            entry.docPos.row <= lastRow + OFFSCREEN_ROWS)
        if (entry.visible !== old) {
          changed = true
        }
      }
      if (changed) {
        this.$scope.$emit('editor:track-changes:visibility_changed')
      }
    }

    _getCurrentDocEntries() {
      const doc_id = this.$scope.docId
      const entries = this.$scope.reviewPanel.entries[doc_id] || {}
      return entries
    }

    updateFocus() {
      if (this.editor) {
        const selection = this.editor.getSelectionRange()
        const selection_start = this._rangeToShareJs(selection.start)
        const selection_end = this._rangeToShareJs(selection.end)
        const is_selection = selection_start !== selection_end
        this.$scope.$emit(
          'editor:focus:changed',
          selection_start,
          selection_end,
          is_selection
        )
      }
    }

    _rangeToShareJs(range) {
      const lines = this.editor
        .getSession()
        .getDocument()
        .getLines(0, range.row)
      return EditorShareJsCodec.rangeToShareJs(range, lines)
    }

    _changeToShareJs(delta) {
      const lines = this.editor
        .getSession()
        .getDocument()
        .getLines(0, delta.start.row)
      return EditorShareJsCodec.changeToShareJs(delta, lines)
    }
  }
  return TrackChangesManager
})
