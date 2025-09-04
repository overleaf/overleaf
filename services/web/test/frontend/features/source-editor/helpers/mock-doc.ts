import { ShareLatexOTShareDoc } from '../../../../../types/share-doc'
import { EventEmitter } from 'events'

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

export const mockDoc = (
  content = defaultContent,
  { rangesOptions = {} } = {}
) => {
  const mockShareJSDoc: ShareLatexOTShareDoc = new MockShareDoc(content)

  return {
    doc_id: docId,
    getType: () => 'sharejs-text-ot',
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
    isHistoryOT: () => false,
  }
}
