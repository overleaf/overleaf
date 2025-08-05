// Migrated from static methods of Document in Document.js

import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { debugConsole } from '@/utils/debugging'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'

export class OpenDocuments {
  private openDocs = new Map<string, DocumentContainer>()

  // eslint-disable-next-line no-useless-constructor
  constructor(
    private readonly socket: Socket,
    private readonly globalEditorWatchdogManager: EditorWatchdogManager,
    private readonly events: IdeEventEmitter
  ) {}

  getDocument(docId: string) {
    // Try to clean up existing docs before reopening them. If the doc has no
    // buffered ops then it will be deleted by _cleanup() and a new instance
    // of the document created below. This prevents us trying to follow the
    // joinDoc:existing code path on an existing doc that doesn't have any
    // local changes and getting an error if its version is too old.
    if (this.openDocs.has(docId)) {
      debugConsole.log(
        `[getDocument] Cleaning up existing document instance for ${docId}`
      )
      this.openDocs.get(docId)?.cleanUp()
    }
    if (!this.openDocs.has(docId)) {
      debugConsole.log(
        `[getDocument] Creating new document instance for ${docId}`
      )
      this.createDoc(docId)
    } else {
      debugConsole.log(
        `[getDocument] Returning existing document instance for ${docId}`
      )
    }
    return this.openDocs.get(docId)
  }

  getUnsavedOpsSize() {
    const docs = this.unsavedDocs()
    let pendingOpsLength = 0
    let inflightOpsLength = 0
    for (const doc of docs) {
      const pendingOp = doc.getPendingOp()
      const inFlightOp = doc.getInflightOp()
      pendingOpsLength += pendingOp?.length || 0
      inflightOpsLength += inFlightOp?.length || 0
    }
    return {
      pendingOpsLength,
      inflightOpsLength,
    }
  }

  private createDoc(docId: string) {
    const doc = new DocumentContainer(
      docId,
      this.socket,
      this.globalEditorWatchdogManager,
      this.events,
      this.detachDoc.bind(this)
    )
    this.openDocs.set(docId, doc)
  }

  detachDoc(docId: string, doc: DocumentContainer) {
    if (this.openDocs.get(docId) === doc) {
      debugConsole.log(
        `[detach] Removing document with ID (${docId}) from openDocs`
      )
      this.openDocs.delete(docId)
    } else {
      // It's possible that this instance has error, and the doc has been reloaded.
      // This creates a new instance in Document.openDoc with the same id. We shouldn't
      // clear it because it's not this instance.
      debugConsole.log(
        `[_cleanUp] New instance of (${docId}) created. Not removing`
      )
    }
  }

  hasUnsavedChanges() {
    for (const doc of this.openDocs.values()) {
      if (doc.hasBufferedOps()) {
        return true
      }
    }
    return false
  }

  flushAll() {
    for (const doc of this.openDocs.values()) {
      doc.flush()
    }
  }

  unsavedDocs() {
    const docs = []
    for (const doc of this.openDocs.values()) {
      if (!doc.pollSavedStatus()) {
        docs.push(doc)
      }
    }
    return docs
  }

  async awaitBufferedOps(signal: AbortSignal) {
    if (this.hasUnsavedChanges()) {
      const { promise, resolve } = Promise.withResolvers<void>()

      let resolved = false

      const listener = () => {
        if (!this.hasUnsavedChanges()) {
          debugConsole.log('saved')
          window.removeEventListener('doc:saved', listener)
          resolved = true
          resolve()
        }
      }

      window.addEventListener('doc:saved', listener)

      signal.addEventListener('abort', () => {
        if (!resolved) {
          debugConsole.log('aborted')
          window.removeEventListener('doc:saved', listener)
          resolve()
        }
      })

      this.flushAll()

      await promise
    }
  }
}
