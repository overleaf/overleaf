/*

  EditorWatchdogManager is used for end-to-end checks of edits.


  The editor UI is backed by Ace and CodeMirrors, which in turn are connected
   to ShareJs documents in the frontend.
  Edits propagate from the editor to ShareJs and are send through socket.io
   and real-time to document-updater.
  In document-updater edits are integrated into the document history and
   a confirmation/rejection is sent back to the frontend.

  Along the way things can get lost.
  We have certain safe-guards in place, but are still getting occasional
   reports of lost edits.

  EditorWatchdogManager is implementing the basis for end-to-end checks on
   two levels:

  - local/ShareJsDoc: edits that pass-by a ShareJs document shall get
     acknowledged eventually.
  - global: any edits made in the editor shall get acknowledged eventually,
     independent for which ShareJs document (potentially none) sees it.

  How does this work?
  ===================

  The global check is using a global EditorWatchdogManager that is available
   via the angular factory 'ide'.
  Local/ShareJsDoc level checks will connect to the global instance.

  Each EditorWatchdogManager keeps track of the oldest un-acknowledged edit.
  When ever a ShareJs document receives an acknowledgement event, a local
   EditorWatchdogManager will see it and also notify the global instance about
   it.
  The next edit cycle will clear the oldest un-acknowledged timestamp in case
   a new ack has arrived, otherwise it will bark loud! via the timeout handler.

  Scenarios
  =========

  - User opens the CodeMirror editor
    - attach global check to new CM instance
    - detach Ace from the local EditorWatchdogManager
    - when the frontend attaches the CM instance to ShareJs, we also
       attach it to the local EditorWatchdogManager
      - the internal attach process writes the document content to the editor,
         which in turn emits 'change' events. These event need to be excluded
         from the watchdog. EditorWatchdogManager.ignoreEditsFor takes care
         of that.
  - User opens the Ace editor (again)
    - (attach global check to the Ace editor, only one copy of Ace is around)
    - detach local EditorWatchdogManager from CM
    - likewise with CM, attach Ace to the local EditorWatchdogManager
  - User makes an edit
    - the editor will emit a 'change' event
    - the global EditorWatchdogManager will process it first
    - the local EditorWatchdogManager will process it next
  - Document-updater confirms an edit
    - the local EditorWatchdogManager will process it first, it passes it on to
    - the global EditorWatchdogManager will process it next

  Time
  ====

  The delay between edits and acks is measured using a monotonic clock:
   `performance.now()`.
  It is agnostic to system clock changes in either direction and timezone
   changes do not affect it as well.
  Roughly speaking, it is initialized with `0` when the `window` context is
   created, before our JS app boots.
  As per canIUse.com and MDN `performance.now()` is available to all supported
   Browsers, including IE11.
  See also: https://caniuse.com/?search=performance.now
  See also: https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
 */

// TIMEOUT specifies the timeout for edits into a single ShareJsDoc.
const TIMEOUT = 60 * 1000
// GLOBAL_TIMEOUT specifies the timeout for edits into any ShareJSDoc.
const GLOBAL_TIMEOUT = TIMEOUT
// REPORT_EVERY specifies how often we send events/report errors.
const REPORT_EVERY = 60 * 1000

const SCOPE_LOCAL = 'ShareJsDoc'
const SCOPE_GLOBAL = 'global'

class Reporter {
  constructor(onTimeoutHandler) {
    this._onTimeoutHandler = onTimeoutHandler
    this._lastReport = undefined
    this._queue = []
  }

  _getMetaPreferLocal() {
    for (const meta of this._queue) {
      if (meta.scope === SCOPE_LOCAL) {
        return meta
      }
    }
    return this._queue.pop()
  }

  onTimeout(meta) {
    // Collect all 'meta's for this update.
    // global arrive before local ones, but we are eager to report local ones.
    this._queue.push(meta)

    setTimeout(() => {
      // Another handler processed the 'meta' entry already
      if (!this._queue.length) return

      const maybeLocalMeta = this._getMetaPreferLocal()

      // Discard other, newly arrived 'meta's
      this._queue.length = 0

      const now = Date.now()
      // Do not flood the server with losing-edits events
      const reportedRecently = now - this._lastReport < REPORT_EVERY
      if (!reportedRecently) {
        this._lastReport = now
        this._onTimeoutHandler(maybeLocalMeta)
      }
    })
  }
}

export default class EditorWatchdogManager {
  constructor({ parent, onTimeoutHandler }) {
    this.scope = parent ? SCOPE_LOCAL : SCOPE_GLOBAL
    this.timeout = parent ? TIMEOUT : GLOBAL_TIMEOUT
    this.parent = parent
    if (parent) {
      this.reporter = parent.reporter
    } else {
      this.reporter = new Reporter(onTimeoutHandler)
    }

    this.lastAck = null
    this.lastUnackedEdit = null
  }

  onAck() {
    this.lastAck = performance.now()

    // bubble up to globalEditorWatchdogManager
    if (this.parent) this.parent.onAck()
  }

  onEdit() {
    // Use timestamps to track the high-water mark of unacked edits
    const now = performance.now()

    // Discard the last unacked edit if there are now newer acks
    if (this.lastAck > this.lastUnackedEdit) {
      this.lastUnackedEdit = null
    }
    // Start tracking for this keypress if we aren't already tracking an
    //  unacked edit
    if (!this.lastUnackedEdit) {
      this.lastUnackedEdit = now
    }

    // Report an error if the last tracked edit hasn't been cleared by an
    //  ack from the server after a long time
    const delay = now - this.lastUnackedEdit
    if (delay > this.timeout) {
      const timeOrigin = Date.now() - now
      const scope = this.scope
      const lastAck = new Date(this.lastAck ? timeOrigin + this.lastAck : 0)
      const lastUnackedEdit = new Date(timeOrigin + this.lastUnackedEdit)
      const meta = { scope, delay, lastAck, lastUnackedEdit }
      this._log('timedOut', meta)
      this.reporter.onTimeout(meta)
    }
  }

  attachToEditor(editorName, editor) {
    let onChange
    if (editorName === 'CM') {
      // CM is passing the CM instance as first parameter, then the change.
      onChange = (editor, change) => {
        // Ignore remote changes.
        if (change.origin === 'remote') return
        this.onEdit()
      }
    } else {
      // ACE is passing the change object as first parameter.
      onChange = change => {
        // Ignore remote changes.
        if (change.origin === 'remote') return
        this.onEdit()
      }
    }
    this._log('attach to editor', editorName)
    editor.on('change', onChange)

    const detachFromEditor = () => {
      this._log('detach from editor', editorName)
      editor.off('change', onChange)
    }
    return detachFromEditor
  }

  _log() {
    sl_console.log(`[EditorWatchdogManager] ${this.scope}:`, ...arguments)
  }
}
