import { docId, mockDoc } from './mock-doc'
import { Folder } from '../../../../../types/folder'

export const mockScope = (content?: string) => {
  return {
    settings: {
      fontSize: 12,
      fontFamily: 'monaco',
      lineHeight: 'normal',
      editorTheme: 'textmate',
      overallTheme: '',
      mode: 'default',
      autoComplete: true,
      autoPairDelimiters: true,
      trackChanges: true,
      syntaxValidation: false,
    },
    editor: {
      sharejs_doc: mockDoc(content),
      open_doc_name: 'test.tex',
      open_doc_id: docId,
      showVisual: false,
    },
    pdf: {
      logEntryAnnotations: {},
    },
    project: {
      _id: 'test-project',
      name: 'Test Project',
      spellCheckLanguage: 'en',
      rootFolder: [] as Folder[],
    },
    onlineUserCursorHighlights: {},
    permissionsLevel: 'owner',
    $on: cy.stub(),
    $broadcast: cy.stub(),
    $emit: cy.stub(),
    $root: {
      _references: {
        keys: ['foo'],
      },
    },
  }
}
