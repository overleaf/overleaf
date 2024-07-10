import { EditorView } from '@codemirror/view'

export const mockScope = () => ({
  settings: {
    syntaxValidation: false,
    pdfViewer: 'pdfjs',
  },
  editor: {
    sharejs_doc: {
      doc_id: 'test-doc',
      getSnapshot: () => 'some doc content',
    },
    view: new EditorView({
      doc: '\\documentclass{article}',
    }),
  },
  hasLintingError: false,
  ui: {
    view: 'editor',
    pdfLayout: 'sideBySide',
  },
})
