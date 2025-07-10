import { docId, mockDoc } from './mock-doc'
import { sleep } from '../../../helpers/sleep'

export const rootFolderId = '012345678901234567890123'
export const mockScope = (
  content?: string,
  { docOptions = {}, permissions = {} }: any = {}
) => {
  return {
    editor: {
      sharejs_doc: mockDoc(content, docOptions),
      openDocName: 'test.tex',
      currentDocumentId: docId,
      wantTrackChanges: false,
    },
    pdf: {
      logEntryAnnotations: {},
    },
    permissions: {
      comment: true,
      trackedWrite: true,
      write: true,
      ...permissions,
    },
    toggleReviewPanel: cy.stub(),
    toggleTrackChangesForEveryone: cy.stub(),
    refreshResolvedCommentsDropdown: cy.stub(() => sleep(1000)),
    onlineUserCursorHighlights: {},
    permissionsLevel: 'owner',
  }
}
