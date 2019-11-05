/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-undef,
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
define([
  'ide/editor/Document',
  'ide/editor/components/spellMenu',
  'ide/editor/directives/aceEditor',
  'ide/editor/directives/toggleSwitch',
  'ide/editor/controllers/SavingNotificationController'
], function(Document) {
  let EditorManager
  return (EditorManager = (function() {
    EditorManager = class EditorManager {
      static initClass() {
        this.prototype._syncTimeout = null
      }
      constructor(ide, $scope, localStorage) {
        this.ide = ide
        this.$scope = $scope
        this.localStorage = localStorage
        this.$scope.editor = {
          sharejs_doc: null,
          open_doc_id: null,
          open_doc_name: null,
          opening: true,
          trackChanges: false,
          wantTrackChanges: false,
          showRichText: this.showRichText()
        }

        this.$scope.$on('entity:selected', (event, entity) => {
          if (this.$scope.ui.view !== 'history' && entity.type === 'doc') {
            return this.openDoc(entity)
          }
        })

        this.$scope.$on('entity:deleted', (event, entity) => {
          if (this.$scope.editor.open_doc_id === entity.id) {
            if (!this.$scope.project.rootDoc_id) {
              return
            }
            const doc = this.ide.fileTreeManager.findEntityById(
              this.$scope.project.rootDoc_id
            )
            if (doc == null) {
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

        this.$scope.$watch('editor.wantTrackChanges', value => {
          if (value == null) {
            return
          }
          return this._syncTrackChangesState(this.$scope.editor.sharejs_doc)
        })
      }

      showRichText() {
        return (
          this.localStorage(`editor.mode.${this.$scope.project_id}`) ===
          'rich-text'
        )
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

      openDoc(doc, options) {
        if (options == null) {
          options = {}
        }
        sl_console.log(`[openDoc] Opening ${doc.id}`)
        this.$scope.ui.view = 'editor'

        const done = () => {
          if (options.gotoLine != null) {
            // allow Ace to display document before moving, delay until next tick
            // added delay to make this happen later that gotoStoredPosition in
            // CursorPositionManager
            return setTimeout(() => {
              return this.$scope.$broadcast(
                'editor:gotoLine',
                options.gotoLine,
                options.gotoColumn
              )
            }, 0)
          } else if (options.gotoOffset != null) {
            return setTimeout(() => {
              return this.$scope.$broadcast(
                'editor:gotoOffset',
                options.gotoOffset
              )
            }, 0)
          }
        }

        if (doc.id === this.$scope.editor.open_doc_id && !options.forceReopen) {
          this.$scope.$apply(() => {
            return done()
          })
          return
        }

        this.$scope.editor.open_doc_id = doc.id
        this.$scope.editor.open_doc_name = doc.name

        this.ide.localStorage(`doc.open_id.${this.$scope.project_id}`, doc.id)
        this.ide.fileTreeManager.selectEntity(doc)

        this.$scope.editor.opening = true
        return this._openNewDocument(doc, (error, sharejs_doc) => {
          if (error != null) {
            this.ide.showGenericMessageModal(
              'Error opening document',
              'Sorry, something went wrong opening this document. Please try again.'
            )
            return
          }

          this._syncTrackChangesState(sharejs_doc)

          this.$scope.$broadcast('doc:opened')

          return this.$scope.$apply(() => {
            this.$scope.editor.opening = false
            this.$scope.editor.sharejs_doc = sharejs_doc
            return done()
          })
        })
      }

      _openNewDocument(doc, callback) {
        if (callback == null) {
          callback = function(error, sharejs_doc) {}
        }
        sl_console.log('[_openNewDocument] Opening...')
        const current_sharejs_doc = this.$scope.editor.sharejs_doc
        if (current_sharejs_doc != null) {
          sl_console.log('[_openNewDocument] Leaving existing open doc...')
          current_sharejs_doc.leaveAndCleanUp()
          this._unbindFromDocumentEvents(current_sharejs_doc)
        }

        const new_sharejs_doc = Document.getDocument(this.ide, doc.id)

        return new_sharejs_doc.join(error => {
          if (error != null) {
            return callback(error)
          }
          this._bindToDocumentEvents(doc, new_sharejs_doc)
          return callback(null, new_sharejs_doc)
        })
      }

      _bindToDocumentEvents(doc, sharejs_doc) {
        sharejs_doc.on('error', (error, meta) => {
          let message
          if ((error != null ? error.message : undefined) != null) {
            ;({ message } = error)
          } else if (typeof error === 'string') {
            message = error
          } else {
            message = ''
          }
          if (/maxDocLength/.test(message)) {
            this.ide.showGenericMessageModal(
              'Document Too Long',
              'Sorry, this file is too long to be edited manually. Please upload it directly.'
            )
          } else if (/too many comments or tracked changes/.test(message)) {
            this.ide.showGenericMessageModal(
              'Too many comments or tracked changes',
              'Sorry, this file has too many comments or tracked changes. Please try accepting or rejecting some existing changes, or resolving and deleting some comments.'
            )
          } else {
            this.ide.socket.disconnect()
            this.ide.reportError(error, meta)
            this.ide.showGenericMessageModal(
              'Out of sync',
              "Sorry, this file has gone out of sync and we need to do a full refresh. <br> <a href='/learn/Kb/Editor_out_of_sync_problems'>Please see this help guide for more information</a>"
            )
          }
          return this.openDoc(doc, { forceReopen: true })
        })

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
          const saved =
            doc.getInflightOp() == null && doc.getPendingOp() == null
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
  })())
})
