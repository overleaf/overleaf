import {
  HistoryOTShareDoc,
  ShareLatexOTShareDoc,
} from '../../../../../types/share-doc'
import { EventEmitter } from 'events'
import { StringFileData } from 'overleaf-editor-core'

export const docId = 'test-doc'

export function mockDocContent(content: string) {
  return `
\\documentclass{article}

\\title{Your Paper}
\\author{You}

\\begin{document}
\\maketitle

\\begin{abstract}
Your abstract.
\\end{abstracts}

\\section{Introduction}

Your introduction goes here!

\\section{Results}

Your results go here! \\cite{foo}

${content}

\\end{document}`
}

const contentLines = Array.from(Array(100), (e, i) => `contentLine ${i}`)
const defaultContent = mockDocContent(contentLines.join('\n'))

const MAX_DOC_LENGTH = 2 * 1024 * 1024 // ol-maxDocLength

class MockShareDoc extends EventEmitter {
  otType = 'sharejs-text-ot' as const
  snapshot = ''

  constructor(public text: string) {
    super()
  }

  getText() {
    return this.text
  }

  insert() {
    // do nothing
  }

  del() {
    // do nothing
  }

  submitOp() {
    // do nothing
  }
}

class MockHistoryOTShareDoc extends EventEmitter {
  otType = 'history-ot' as const
  snapshot: StringFileData
  submitOp: (op: any[]) => void

  constructor(public text: string) {
    super()
    this.snapshot = new StringFileData(text)
    // Stubbed so tests can assert whether an op was submitted for the open doc
    // instead of going through the HTTP API.
    this.submitOp = cy.stub().as('historyOTSubmitOp')
  }

  getText() {
    return this.text
  }
}

export const mockDoc = (
  content = defaultContent,
  { rangesOptions = {}, historyOT = false } = {}
) => {
  const mockShareJSDoc: ShareLatexOTShareDoc | HistoryOTShareDoc = historyOT
    ? new MockHistoryOTShareDoc(content)
    : new MockShareDoc(content)

  return {
    doc_id: docId,
    getType: () => (historyOT ? 'history-ot' : 'sharejs-text-ot'),
    historyOTShareDoc: mockShareJSDoc,
    // The history-ot CodeMirror extension reads the share doc through
    // `doc._doc` rather than through `historyOTShareDoc`.
    doc: historyOT ? { _doc: mockShareJSDoc } : undefined,
    getSnapshot: () => {
      return content
    },
    attachToCM6: (cm6: any) => {
      cm6.attachShareJs(mockShareJSDoc, MAX_DOC_LENGTH)
    },
    detachFromCM6: () => {
      // Do nothing
    },
    on: () => {
      // Do nothing
    },
    off: () => {
      // Do nothing
    },
    ranges: {
      changes: [],
      comments: [],
      getIdSeed: () => '123',
      setIdSeed: () => {},
      getTrackedDeletesLength: () => 0,
      getDirtyState: () => ({
        comment: {
          moved: {},
          removed: {},
          added: {},
        },
        change: {
          moved: {},
          removed: {},
          added: {},
        },
      }),
      resetDirtyState: () => {},
      removeCommentId: () => {},
      ...rangesOptions,
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    submitOp: (op: any) => {},
    setTrackChangesIdSeeds: () => {},
    getTrackingChanges: () => true,
    setTrackChangesUserId: () => {},
    getInflightOp: () => null,
    getPendingOp: () => null,
    hasBufferedOps: () => false,
    leaveAndCleanUpPromise: () => false,
    isHistoryOT: () => historyOT,
  }
}
