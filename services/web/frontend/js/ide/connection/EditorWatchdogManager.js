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

export default class EditorWatchdogManager {
  constructor({ parent, onTimeoutHandler }) {
    this.timeout = parent ? TIMEOUT : GLOBAL_TIMEOUT
    this.parent = parent
    this.onTimeoutHandler =
      onTimeoutHandler || (parent && parent.onTimeoutHandler)

    this.lastAck = null
    this.lastUnackedEdit = null
    this.lastReport = null
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
      const scope = this.parent ? 'ShareJsDoc' : 'global'
      const lastAck = new Date(this.lastAck ? timeOrigin + this.lastAck : 0)
      const lastUnackedEdit = new Date(timeOrigin + this.lastUnackedEdit)
      const meta = { scope, delay, lastAck, lastUnackedEdit }
      this._log('timedOut', meta)

      // do not flood the server with losing-edits events
      const reportedRecently = now - this.lastReport < REPORT_EVERY
      if (!reportedRecently) {
        this.lastReport = now
        if (this.parent) {
          // report this timeout once from the lowest level
          this.parent.lastReport = this.lastReport
        }
        this.onTimeoutHandler(meta)
      }
    }
  }

  attachToEditor(editorName, editor) {
    const onChangeFn = change => {
      // Ignore remote changes.
      if (change.origin !== 'remote') this.onEdit()
    }
    let onChange
    if (!this.parent) {
      // Change events are processed in sequence, starting with the listener
      //  that attaches first.
      // The global watchdog attaches before the local one does.
      // We want to report bottom up in any case (ShareJs -> global), not just
      //  for continuous edits (which the different timeouts achieved), but
      //  also for delayed edits: a user leaves their desk, comes back after
      //  10min and edits again.
      // The global watchdog would see the edit first, potentially reporting a
      //  missed ack attributed to a missing ShareJsDoc -- even tho a doc is
      //  still active and listening for edits.
      // Delay the run of the global handler into the next event loop cycle.
      onChange = change => setTimeout(onChangeFn, 0, change)
    } else {
      onChange = onChangeFn
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
    const scope = this.parent ? 'ShareJsDoc' : 'global'
    sl_console.log(`[EditorWatchdogManager] ${scope}:`, ...arguments)
  }
}
