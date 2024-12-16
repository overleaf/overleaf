import { docId, mockDoc } from './mock-doc'
import { sleep } from '../../../helpers/sleep'
import { Folder } from '../../../../../types/folder'

export const rootFolderId = '012345678901234567890123'
export const figuresFolderId = '123456789012345678901234'
export const figureId = '234567890123456789012345'
export const mockScope = (content?: string) => {
  return {
    editor: {
      sharejs_doc: mockDoc(content),
      open_doc_name: 'test.tex',
      open_doc_id: docId,
      showVisual: false,
      wantTrackChanges: false,
    },
    pdf: {
      logEntryAnnotations: {},
    },
    project: {
      _id: 'test-project',
      name: 'Test Project',
      spellCheckLanguage: 'en',
      rootFolder: [
        {
          _id: rootFolderId,
          name: 'rootFolder',
          docs: [
            {
              _id: docId,
              name: 'test.tex',
            },
          ],
          folders: [
            {
              _id: figuresFolderId,
              name: 'figures',
              docs: [],
              folders: [],
              fileRefs: [
                {
                  _id: figureId,
                  name: 'frog.jpg',
                  hash: '42',
                },
                {
                  _id: 'fake-figure-id',
                  name: 'unicorn.png',
                  hash: '43',
                },
              ],
            },
          ],
          fileRefs: [],
        },
      ] as Folder[],
      features: {
        trackChanges: true,
      },
      trackChangesState: {},
      members: [],
    },
    permissions: {
      comment: true,
      trackedWrite: true,
      write: true,
    },
    reviewPanel: {
      subView: 'cur_file',
      formattedProjectMembers: {},
      fullTCStateCollapsed: true,
      entries: {},
      resolvedComments: {},
    },
    ui: {
      reviewPanelOpen: true,
    },
    toggleReviewPanel: cy.stub(),
    toggleTrackChangesForEveryone: cy.stub(),
    refreshResolvedCommentsDropdown: cy.stub(() => sleep(1000)),
    onlineUserCursorHighlights: {},
    permissionsLevel: 'owner',
    $on: cy.stub().log(false),
    $broadcast: cy.stub().log(false),
    $emit: cy.stub().log(false),
  }
}
