define(['ace/ace'], function() {
  const BuiltInUndoManager = ace.require('ace/undomanager').UndoManager

  class UndoManager {
    constructor(editor) {
      this.editor = editor

      this.onChangeSession = this.onChangeSession.bind(this)
      this.onChange = this.onChange.bind(this)
    }

    onChangeSession(session) {
      session.setUndoManager(new BuiltInUndoManager())
    }

    onChange(change) {
      if (!change.remote) return

      // HACK: remote changes in Ace are added by the ShareJS/Ace adapter
      // asynchronously via a timeout (see attach_ace function). This makes it
      // impossible to clear to undo stack when remote changes are received.
      // To hack around this we queue the undo stack clear so that it applies
      // after the change is applied
      setTimeout(() => {
        this.editor
          .getSession()
          .getUndoManager()
          .reset()
      })
    }
  }

  return UndoManager
})
