import _ from 'lodash'
/* eslint-disable
   camelcase,
   n/handle-callback-err,
   max-len,
   no-return-assign,
 */
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import Document from './Document'
import './components/spellMenu'
import './directives/aceEditor'
import './directives/toggleSwitch'
import './controllers/SavingNotificationController'
import './controllers/CompileButton'
import './controllers/SwitchToPDFButton'
import getMeta from '../../utils/meta'
import { hasSeenCM6SwitchAwaySurvey } from '../../features/source-editor/utils/switch-away-survey'

let EditorManager

export default EditorManager = (function () {
  EditorManager = class EditorManager {
    static initClass() {
      this.prototype._syncTimeout = null
    }

    constructor(ide, $scope, localStorage, eventTracking) {
      this.ide = ide
      this.editorOpenDocEpoch = 0 // track pending document loads
      this.$scope = $scope
      this.localStorage = localStorage
      this.$scope.editor = {
        sharejs_doc: null,
        open_doc_id: null,
        open_doc_name: null,
        opening: true,
        trackChanges: false,
        wantTrackChanges: false,
        docTooLongErrorShown: false,
        showRichText: this.showRichText(),
        showVisual: this.showVisual(),
        newSourceEditor: this.newSourceEditor(),
        showSymbolPalette: false,
        toggleSymbolPalette: () => {
          const newValue = !this.$scope.editor.showSymbolPalette
          this.$scope.editor.showSymbolPalette = newValue
          if (newValue && this.$scope.editor.showGalileo) {
            this.$scope.editor.toggleGalileoPanel()
          }
          ide.$scope.$emit('south-pane-toggled', newValue)
          eventTracking.sendMB(
            newValue ? 'symbol-palette-show' : 'symbol-palette-hide'
          )
        },
        insertSymbol: symbol => {
          ide.$scope.$emit('editor:replace-selection', symbol.command)
          eventTracking.sendMB('symbol-palette-insert')
        },
        showGalileo: false,
        toggleGalileoPanel: () => {
          const newValue = !this.$scope.editor.showGalileo
          this.$scope.editor.showGalileo = newValue
          if (newValue && this.$scope.editor.showSymbolPalette) {
            this.$scope.editor.toggleSymbolPalette()
          }
          ide.$scope.$emit('south-pane-toggled', newValue)
          eventTracking.sendMB(newValue ? 'galileo-show' : 'galileo-hide')
        },
        galileoActivated: false,
        toggleGalileo: () => {
          const newValue = !this.$scope.editor.galileoActivated
          this.$scope.editor.galileoActivated = newValue
          eventTracking.sendMB(
            newValue ? 'galileo-activated' : 'galileo-disabled'
          )
        },
        multiSelectedCount: 0,
      }

      window.addEventListener('editor:insert-symbol', event => {
        this.$scope.editor.insertSymbol(event.detail)
      })

      this.$scope.$on('entity:selected', (event, entity) => {
        if (this.$scope.ui.view !== 'history' && entity.type === 'doc') {
          return this.openDoc(entity)
        }
      })

      this.$scope.$on('entity:no-selection', () => {
        this.$scope.$apply(() => {
          this.$scope.ui.view = null
        })
      })

      this.$scope.$on('entity:deleted', (event, entity) => {
        if (this.$scope.editor.open_doc_id === entity.id) {
          if (!this.$scope.project.rootDoc_id) {
            this.$scope.ui.view = null
            return
          }
          const doc = this.ide.fileTreeManager.findEntityById(
            this.$scope.project.rootDoc_id
          )
          if (doc == null) {
            this.$scope.ui.view = null
            return
          }
          return this.openDoc(doc)
        }
      })

      let initialized = false
      this.$scope.$on('file-tree:initialized', () => {
        if (!initialized) {
          initialized = true
          return this.autoOpenDoc()
        }
      })

      this.$scope.$on('flush-changes', () => {
        return Document.flushAll()
      })

      // event dispatched by pdf preview
      window.addEventListener('flush-changes', () => {
        Document.flushAll()
      })

      window.addEventListener('blur', () => {
        // The browser may put the tab into sleep as it looses focus.
        // Flushing the documents should help with keeping the documents in
        //  sync: we can use any new version of the doc that the server may
        //  present us. There should be no need to insert local changes into
        //  the doc history as the user comes back.
        sl_console.log('[EditorManager] forcing flush onblur')
        Document.flushAll()
      })

      this.$scope.$watch('editor.wantTrackChanges', value => {
        if (value == null) {
          return
        }
        return this._syncTrackChangesState(this.$scope.editor.sharejs_doc)
      })

      window.addEventListener('editor:open-doc', event => {
        const { doc, ...options } = event.detail
        this.openDoc(doc, options)
      })
    }

    getEditorType() {
      if (!this.$scope.editor.sharejs_doc) {
        return null
      }

      let editorType = this.$scope.editor.sharejs_doc.editorType()

      if (editorType === 'cm6' && this.$scope.editor.showVisual) {
        editorType = 'cm6-rich-text'
      }

      return editorType
    }

    showRichText() {
      if (getMeta('ol-richTextVariant') === 'cm6') {
        return false
      }

      return (
        this.localStorage(`editor.mode.${this.$scope.project_id}`) ===
        'rich-text'
      )
    }

    showVisual() {
      if (getMeta('ol-richTextVariant') !== 'cm6') {
        return false
      }

      return (
        this.localStorage(`editor.mode.${this.$scope.project_id}`) ===
        'rich-text'
      )
    }

    newSourceEditor() {
      // Use the new source editor if the legacy editor is disabled
      if (!getMeta('ol-showLegacySourceEditor')) {
        return true
      }

      const storedPrefIsCM6 = () => {
        const sourceEditor = this.localStorage(
          `editor.source_editor.${this.$scope.project_id}`
        )

        return sourceEditor === 'cm6' || sourceEditor == null
      }

      const showCM6SwitchAwaySurvey = getMeta('ol-showCM6SwitchAwaySurvey')

      if (!showCM6SwitchAwaySurvey) {
        return storedPrefIsCM6()
      }

      if (hasSeenCM6SwitchAwaySurvey()) {
        return storedPrefIsCM6()
      } else {
        // force user to switch to cm6 if they haven't seen either of the
        // switch-away surveys
        return true
      }
    }

    autoOpenDoc() {
      const open_doc_id =
        this.ide.localStorage(`doc.open_id.${this.$scope.project_id}`) ||
        this.$scope.project.rootDoc_id
      if (open_doc_id == null) {
        return
      }
      const doc = this.ide.fileTreeManager.findEntityById(open_doc_id)
      if (doc == null) {
        return
      }
      return this.openDoc(doc)
    }

    openDocId(doc_id, options) {
      if (options == null) {
        options = {}
      }
      const doc = this.ide.fileTreeManager.findEntityById(doc_id)
      if (doc == null) {
        return
      }
      return this.openDoc(doc, options)
    }

    jumpToLine(options) {
      return this.$scope.$broadcast(
        'editor:gotoLine',
        options.gotoLine,
        options.gotoColumn,
        options.syncToPdf
      )
    }

    openDoc(doc, options) {
      if (options == null) {
        options = {}
      }
      sl_console.log(`[openDoc] Opening ${doc.id}`)
      if (this.$scope.ui.view === 'editor') {
        // store position of previous doc before switching docs
        this.$scope.$broadcast('store-doc-position')
      }
      this.$scope.ui.view = 'editor'

      const done = isNewDoc => {
        const eventName = 'doc:after-opened'
        this.$scope.$broadcast(eventName, { isNewDoc })
        window.dispatchEvent(new CustomEvent(eventName, { detail: isNewDoc }))
        if (options.gotoLine != null) {
          // allow Ace to display document before moving, delay until next tick
          // added delay to make this happen later that gotoStoredPosition in
          // CursorPositionManager
          setTimeout(() => this.jumpToLine(options))
          // when opening a doc in CM6, jump to the line again after a stored scroll position has been restored
          if (isNewDoc) {
            window.addEventListener(
              'editor:scroll-position-restored',
              () => this.jumpToLine(options),
              { once: true }
            )
          }
        } else if (options.gotoOffset != null) {
          setTimeout(() => {
            this.$scope.$broadcast('editor:gotoOffset', options.gotoOffset)
          })
        }
      }

      // If we already have the document open we can return at this point.
      // Note: only use forceReopen:true to override this when the document is
      // is out of sync and needs to be reloaded from the server.
      if (doc.id === this.$scope.editor.open_doc_id && !options.forceReopen) {
        // automatically update the file tree whenever the file is opened
        this.ide.fileTreeManager.selectEntity(doc)
        this.$scope.$broadcast('file-tree.reselectDoc', doc.id)
        this.$scope.$apply(() => {
          return done(false)
        })
        return
      }

      this.$scope.$applyAsync(() => {
        // We're now either opening a new document or reloading a broken one.
        this.$scope.editor.open_doc_id = doc.id
        this.$scope.editor.open_doc_name = doc.name

        this.ide.localStorage(`doc.open_id.${this.$scope.project_id}`, doc.id)
        this.ide.fileTreeManager.selectEntity(doc)

        this.$scope.editor.opening = true
        return this._openNewDocument(doc, (error, sharejs_doc) => {
          if (error && error.message === 'another document was loaded') {
            sl_console.log(
              `[openDoc] another document was loaded while ${doc.id} was loading`
            )
            return
          }
          if (error != null) {
            this.ide.showGenericMessageModal(
              'Error opening document',
              'Sorry, something went wrong opening this document. Please try again.'
            )
            return
          }

          this._syncTrackChangesState(sharejs_doc)

          this.$scope.$broadcast('doc:opened')

          return this.$scope.$applyAsync(() => {
            this.$scope.editor.opening = false
            this.$scope.editor.sharejs_doc = sharejs_doc
            return done(true)
          })
        })
      })
    }

    _openNewDocument(doc, callback) {
      // Leave the current document
      //  - when we are opening a different new one, to avoid race conditions
      //     between leaving and joining the same document
      //  - when the current one has pending ops that need flushing, to avoid
      //     race conditions from cleanup
      const current_sharejs_doc = this.$scope.editor.sharejs_doc
      const currentDocId = current_sharejs_doc && current_sharejs_doc.doc_id
      const hasBufferedOps =
        current_sharejs_doc && current_sharejs_doc.hasBufferedOps()
      const changingDoc = current_sharejs_doc && currentDocId !== doc.id
      if (changingDoc || hasBufferedOps) {
        sl_console.log('[_openNewDocument] Leaving existing open doc...')

        // Do not trigger any UI changes from remote operations
        this._unbindFromDocumentEvents(current_sharejs_doc)
        // Keep listening for out-of-sync and similar errors.
        this._attachErrorHandlerToDocument(doc, current_sharejs_doc)

        // Teardown the Document -> ShareJsDoc -> sharejs doc
        // By the time this completes, the Document instance is no longer
        //  registered in Document.openDocs and _doOpenNewDocument can start
        //  from scratch -- read: no corrupted internal state.
        const editorOpenDocEpoch = ++this.editorOpenDocEpoch
        current_sharejs_doc.leaveAndCleanUp(error => {
          if (error) {
            sl_console.log(
              `[_openNewDocument] error leaving doc ${currentDocId}`,
              error
            )
            return callback(error)
          }
          if (this.editorOpenDocEpoch !== editorOpenDocEpoch) {
            sl_console.log(
              `[openNewDocument] editorOpenDocEpoch mismatch ${this.editorOpenDocEpoch} vs ${editorOpenDocEpoch}`
            )
            return callback(new Error('another document was loaded'))
          }
          this._doOpenNewDocument(doc, callback)
        })
      } else {
        this._doOpenNewDocument(doc, callback)
      }
    }

    _doOpenNewDocument(doc, callback) {
      if (callback == null) {
        callback = function () {}
      }
      sl_console.log('[_doOpenNewDocument] Opening...')
      const new_sharejs_doc = Document.getDocument(this.ide, doc.id)
      const editorOpenDocEpoch = ++this.editorOpenDocEpoch
      return new_sharejs_doc.join(error => {
        if (error != null) {
          sl_console.log(
            `[_doOpenNewDocument] error joining doc ${doc.id}`,
            error
          )
          return callback(error)
        }
        if (this.editorOpenDocEpoch !== editorOpenDocEpoch) {
          sl_console.log(
            `[openNewDocument] editorOpenDocEpoch mismatch ${this.editorOpenDocEpoch} vs ${editorOpenDocEpoch}`
          )
          new_sharejs_doc.leaveAndCleanUp()
          return callback(new Error('another document was loaded'))
        }
        this._bindToDocumentEvents(doc, new_sharejs_doc)
        return callback(null, new_sharejs_doc)
      })
    }

    _attachErrorHandlerToDocument(doc, sharejs_doc) {
      sharejs_doc.on('error', (error, meta, editorContent) => {
        let message
        if ((error != null ? error.message : undefined) != null) {
          ;({ message } = error)
        } else if (typeof error === 'string') {
          message = error
        } else {
          message = ''
        }
        if (/maxDocLength/.test(message)) {
          this.$scope.docTooLongErrorShown = true
          this.openDoc(doc, { forceReopen: true })
          const genericMessageModal = this.ide.showGenericMessageModal(
            'Document Too Long',
            'Sorry, this file is too long to be edited manually. Please upload it directly.'
          )
          genericMessageModal.result.finally(() => {
            this.$scope.docTooLongErrorShown = false
          })
        } else if (/too many comments or tracked changes/.test(message)) {
          this.ide.showGenericMessageModal(
            'Too many comments or tracked changes',
            'Sorry, this file has too many comments or tracked changes. Please try accepting or rejecting some existing changes, or resolving and deleting some comments.'
          )
        } else if (!this.$scope.docTooLongErrorShown) {
          // Do not allow this doc to open another error modal.
          sharejs_doc.off('error')

          // Preserve the sharejs contents before the teardown.
          editorContent =
            typeof editorContent === 'string'
              ? editorContent
              : sharejs_doc.doc._doc.snapshot

          // Tear down the ShareJsDoc.
          if (sharejs_doc.doc) sharejs_doc.doc.clearInflightAndPendingOps()

          // Do not re-join after re-connecting.
          sharejs_doc.leaveAndCleanUp()
          this.ide.connectionManager.disconnect({ permanent: true })
          this.ide.reportError(error, meta)

          // Tell the user about the error state.
          this.$scope.editor.error_state = true
          this.ide.showOutOfSyncModal(
            'Out of sync',
            "Sorry, this file has gone out of sync and we need to do a full refresh. <br> <a target='_blank' rel='noopener noreferrer' href='/learn/Kb/Editor_out_of_sync_problems'>Please see this help guide for more information</a>",
            editorContent
          )
          // Do not forceReopen the document.
          return
        }
        const removeHandler = this.$scope.$on('project:joined', () => {
          this.openDoc(doc, { forceReopen: true })
          removeHandler()
        })
      })
    }

    _bindToDocumentEvents(doc, sharejs_doc) {
      this._attachErrorHandlerToDocument(doc, sharejs_doc)

      return sharejs_doc.on('externalUpdate', update => {
        if (this._ignoreExternalUpdates) {
          return
        }
        if (
          _.property(['meta', 'type'])(update) === 'external' &&
          _.property(['meta', 'source'])(update) === 'git-bridge'
        ) {
          return
        }
        return this.ide.showGenericMessageModal(
          'Document Updated Externally',
          'This document was just updated externally. Any recent changes you have made may have been overwritten. To see previous versions please look in the history.'
        )
      })
    }

    _unbindFromDocumentEvents(document) {
      return document.off()
    }

    getCurrentDocValue() {
      return this.$scope.editor.sharejs_doc != null
        ? this.$scope.editor.sharejs_doc.getSnapshot()
        : undefined
    }

    getCurrentDocId() {
      return this.$scope.editor.open_doc_id
    }

    startIgnoringExternalUpdates() {
      return (this._ignoreExternalUpdates = true)
    }

    stopIgnoringExternalUpdates() {
      return (this._ignoreExternalUpdates = false)
    }

    _syncTrackChangesState(doc) {
      let tryToggle
      if (doc == null) {
        return
      }

      if (this._syncTimeout != null) {
        clearTimeout(this._syncTimeout)
        this._syncTimeout = null
      }

      const want = this.$scope.editor.wantTrackChanges
      const have = doc.getTrackingChanges()
      if (want === have) {
        this.$scope.editor.trackChanges = want
        return
      }

      return (tryToggle = () => {
        const saved = doc.getInflightOp() == null && doc.getPendingOp() == null
        if (saved) {
          doc.setTrackingChanges(want)
          return this.$scope.$apply(() => {
            return (this.$scope.editor.trackChanges = want)
          })
        } else {
          return (this._syncTimeout = setTimeout(tryToggle, 100))
        }
      })()
    }
  }
  EditorManager.initClass()
  return EditorManager
})()
