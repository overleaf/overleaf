import { MainDocument, PdfViewer } from '../../../../types/project-settings'

type Scope = {
  settings?: {
    syntaxValidation?: boolean
    pdfViewer?: PdfViewer
  }
  editor?: {
    sharejs_doc?: {
      doc_id?: string
      getSnapshot?: () => string
    }
    newSourceEditor?: boolean
  }
  hasLintingError?: boolean
  ui?: {
    view?: 'editor' | 'history' | 'file' | 'pdf'
    pdfLayout?: 'flat' | 'sideBySide' | 'split'
    leftMenuShown?: boolean
  }
  project?: {
    members?: any[]
    owner: {
      _id: string
    }
  }
  user?: {
    features?: {
      dropbox: boolean
    }
  }
  docs?: MainDocument[]
}

export const mockScope = (scope?: Scope) => ({
  settings: {
    syntaxValidation: false,
    pdfViewer: 'pdfjs',
  },
  editor: {
    sharejs_doc: {
      doc_id: 'test-doc',
      getSnapshot: () => 'some doc content',
    },
    newSourceEditor: true,
  },
  hasLintingError: false,
  ui: {
    view: 'editor',
    pdfLayout: 'sideBySide',
    leftMenuShown: false,
  },
  ...scope,
})
