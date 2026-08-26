'use strict'

const assert = require('check-types').assert

const Origin = require('.')

/**
 * An Origin for a change an editor client submitted over the `applyHistoryOt`
 * rpc.
 *
 * The `editorId` identifies the editor instance the change came from. It is what
 * scopes the change's timestamp: a client keeps its timestamps distinct, but two
 * clients of the same user do not coordinate, so the pair is what identifies a
 * submission. history-v1 uses it to recognise a change it has already applied,
 * rather than applying a resend twice.
 *
 * It is only needed while a change can still be resent, so it is dropped from
 * all but the latest change of an editor when a chunk is written to storage. The
 * plain {@link Origin} with this kind is what remains, and it keeps recording
 * that the change came from the editor.
 */
class EditorOrigin extends Origin {
  /**
   * @param {string} editorId a UUID identifying the editor instance
   */
  constructor(editorId) {
    assert.nonEmptyString(editorId, 'EditorOrigin: bad editorId')

    super(EditorOrigin.KIND)
    this.editorId = editorId
  }

  static fromRaw(raw) {
    return new EditorOrigin(raw.editorId)
  }

  /** @inheritdoc */
  toRaw() {
    return {
      kind: EditorOrigin.KIND,
      editorId: this.editorId,
    }
  }

  /**
   * @return {string}
   */
  getEditorId() {
    return this.editorId
  }
}

EditorOrigin.KIND = Origin.EDITOR_ORIGIN_KIND

module.exports = EditorOrigin
