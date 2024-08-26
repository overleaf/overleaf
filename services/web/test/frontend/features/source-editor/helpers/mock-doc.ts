import { ShareDoc } from '../../../../../types/share-doc'
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
}

export const mockDoc = (content = defaultContent) => {
  const mockShareJSDoc: ShareDoc = new MockShareDoc(content)

  return {
    doc_id: docId,
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
    },
    setTrackChangesIdSeeds: () => {},
    getTrackingChanges: () => true,
    setTrackingChanges: () => {},
    getInflightOp: () => null,
    getPendingOp: () => null,
  }
}
