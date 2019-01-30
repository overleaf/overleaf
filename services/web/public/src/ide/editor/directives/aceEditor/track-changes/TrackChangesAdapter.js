/* eslint-disable
    camelcase
 */
define(['ace/ace', 'ide/editor/EditorShareJsCodec'], function(
  _ignore,
  EditorShareJsCodec
) {
  const { Range } = ace.require('ace/range')
  class TrackChangesAdapter {
    constructor(editor) {
      this.editor = editor
      this.changeIdToMarkerIdMap = {}
    }

    tearDown() {
      this.changeIdToMarkerIdMap = {}
    }

    clearAnnotations() {
      const session = this.editor.getSession()
      for (let change_id in this.changeIdToMarkerIdMap) {
        const markers = this.changeIdToMarkerIdMap[change_id]
        for (let marker_name in markers) {
          const marker_id = markers[marker_name]
          session.removeMarker(marker_id)
        }
      }
      this.changeIdToMarkerIdMap = {}
    }

    onInsertAdded(change) {
      const start = this.shareJsOffsetToRowColumn(change.op.p)
      const end = this.shareJsOffsetToRowColumn(
        change.op.p + change.op.i.length
      )

      const session = this.editor.getSession()
      const background_range = new Range(
        start.row,
        start.column,
        end.row,
        end.column
      )
      const background_marker_id = session.addMarker(
        background_range,
        'track-changes-marker track-changes-added-marker',
        'text'
      )
      const callout_marker_id = this.createCalloutMarker(
        start,
        'track-changes-added-marker-callout'
      )

      this.changeIdToMarkerIdMap[change.id] = {
        background_marker_id,
        callout_marker_id
      }
    }

    onDeleteAdded(change) {
      const position = this.shareJsOffsetToRowColumn(change.op.p)
      const session = this.editor.getSession()

      const markerLayer = this.editor.renderer.$markerBack
      const klass = 'track-changes-marker track-changes-deleted-marker'
      const background_range = this.makeZeroWidthRange(position)
      const background_marker_id = session.addMarker(
        background_range,
        klass,
        (html, range, left, top, config) =>
          markerLayer.drawSingleLineMarker(
            html,
            range,
            `${klass} ace_start`,
            config,
            0,
            ''
          )
      )

      const callout_marker_id = this.createCalloutMarker(
        position,
        'track-changes-deleted-marker-callout'
      )

      this.changeIdToMarkerIdMap[change.id] = {
        background_marker_id,
        callout_marker_id
      }
    }

    onInsertRemoved(change) {
      const {
        background_marker_id,
        callout_marker_id
      } = this.changeIdToMarkerIdMap[change.id]
      delete this.changeIdToMarkerIdMap[change.id]
      const session = this.editor.getSession()
      session.removeMarker(background_marker_id)
      session.removeMarker(callout_marker_id)
    }

    onDeleteRemoved(change) {
      const {
        background_marker_id,
        callout_marker_id
      } = this.changeIdToMarkerIdMap[change.id]
      delete this.changeIdToMarkerIdMap[change.id]

      const session = this.editor.getSession()
      session.removeMarker(background_marker_id)
      session.removeMarker(callout_marker_id)
    }

    onChangeMoved(change) {
      let end
      const start = this.shareJsOffsetToRowColumn(change.op.p)
      if (change.op.i != null) {
        end = this.shareJsOffsetToRowColumn(change.op.p + change.op.i.length)
      } else {
        end = start
      }
      this.updateMarker(change.id, start, end)
    }

    onCommentAdded(comment) {
      if (this.changeIdToMarkerIdMap[comment.id] == null) {
        // Only create new markers if they don't already exist
        const start = this.shareJsOffsetToRowColumn(comment.op.p)
        const end = this.shareJsOffsetToRowColumn(
          comment.op.p + comment.op.c.length
        )
        const session = this.editor.getSession()
        const background_range = new Range(
          start.row,
          start.column,
          end.row,
          end.column
        )
        const background_marker_id = session.addMarker(
          background_range,
          'track-changes-marker track-changes-comment-marker',
          'text'
        )
        const callout_marker_id = this.createCalloutMarker(
          start,
          'track-changes-comment-marker-callout'
        )
        this.changeIdToMarkerIdMap[comment.id] = {
          background_marker_id,
          callout_marker_id
        }
      }
    }

    onCommentMoved(comment) {
      const start = this.shareJsOffsetToRowColumn(comment.op.p)
      const end = this.shareJsOffsetToRowColumn(
        comment.op.p + comment.op.c.length
      )
      this.updateMarker(comment.id, start, end)
    }

    onCommentRemoved(comment) {
      if (this.changeIdToMarkerIdMap[comment.id] != null) {
        // Resolved comments may not have marker ids
        const {
          background_marker_id,
          callout_marker_id
        } = this.changeIdToMarkerIdMap[comment.id]
        delete this.changeIdToMarkerIdMap[comment.id]
        const session = this.editor.getSession()
        session.removeMarker(background_marker_id)
        session.removeMarker(callout_marker_id)
      }
    }

    updateMarker(change_id, start, end) {
      if (this.changeIdToMarkerIdMap[change_id] == null) {
        return
      }
      const session = this.editor.getSession()
      const markers = session.getMarkers()
      const {
        background_marker_id,
        callout_marker_id
      } = this.changeIdToMarkerIdMap[change_id]
      if (
        background_marker_id != null &&
        markers[background_marker_id] != null
      ) {
        const background_marker = markers[background_marker_id]
        background_marker.range.start = start
        background_marker.range.end = end
      }
      if (callout_marker_id != null && markers[callout_marker_id] != null) {
        const callout_marker = markers[callout_marker_id]
        callout_marker.range.start = start
        callout_marker.range.end = start
      }
    }

    shareJsOffsetToRowColumn(offset) {
      const lines = this.editor
        .getSession()
        .getDocument()
        .getAllLines()
      return EditorShareJsCodec.shareJsOffsetToRowColumn(offset, lines)
    }

    createCalloutMarker(position, klass) {
      const session = this.editor.getSession()
      const callout_range = this.makeZeroWidthRange(position)
      const markerLayer = this.editor.renderer.$markerBack
      return session.addMarker(
        callout_range,
        klass,
        (html, range, left, top, config) =>
          markerLayer.drawSingleLineMarker(
            html,
            range,
            `track-changes-marker-callout ${klass} ace_start`,
            config,
            0,
            'width: auto; right: 0;'
          )
      )
    }

    makeZeroWidthRange(position) {
      const ace_range = new Range(
        position.row,
        position.column,
        position.row,
        position.column
      )
      // Our delete marker is zero characters wide, but Ace doesn't draw ranges
      // that are empty. So we monkey patch the range to tell Ace it's not empty
      // We do want to claim to be empty if we're off screen after clipping rows
      //  though. This is the code we need to trick:
      //   var range = marker.range.clipRows(config.firstRow, config.lastRow);
      //   if (range.isEmpty()) continue;
      ace_range.clipRows = function(first_row, last_row) {
        this.isEmpty = function() {
          return first_row > this.end.row || last_row < this.start.row
        }
        return this
      }
      return ace_range
    }
  }
  return TrackChangesAdapter
})
