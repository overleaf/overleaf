import { docId, mockDoc } from './mock-doc'
import { Folder } from '../../../../../types/folder'
export const rootFolderId = '012345678901234567890123'
export const figuresFolderId = '123456789012345678901234'
export const figureId = '234567890123456789012345'
export const mockScope = (content?: string) => {
  return {
    rootFolder: {
      id: rootFolderId,
      name: 'rootFolder',
      selected: false,
      children: [
        {
          id: docId,
          name: 'test.tex',
          selected: false,
          type: 'doc',
        },
        {
          id: figuresFolderId,
          name: 'figures',
          selected: false,
          type: 'folder',
          children: [
            {
              id: figureId,
              name: 'frog.jpg',
              selected: false,
              type: 'file',
            },
            {
              id: 'fake-figure-id',
              name: 'unicorn.png',
              selected: false,
              type: 'file',
            },
          ],
        },
      ],
    },
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
