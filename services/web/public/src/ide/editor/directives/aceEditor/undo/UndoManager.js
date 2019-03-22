define(['ace/ace'], function() {
  const BuiltInUndoManager = ace.require('ace/undomanager').UndoManager

  class UndoManager {
    constructor($scope, editor) {
      editor.on('changeSession', e => {
        e.session.setUndoManager(new BuiltInUndoManager())

        e.oldSession.off('change', onChange)
        e.session.on('change', onChange)
      })

      function onChange(change) {
        if (!change.remote) return

        // HACK: remote changes in Ace are added by the ShareJS/Ace adapter
        // asynchronously via a timeout (see attach_ace function). This makes it
        // impossible to clear to undo stack when remote changes are received.
        // To hack around this we queue the undo stack clear so that it applies
        // after the change is applied
        setTimeout(() => {
          editor
            .getSession()
            .getUndoManager()
            .reset()
        })
      }
    }
  }

  return UndoManager
})
