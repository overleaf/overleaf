import { docId } from './mock-doc'
import { Folder } from '../../../../../types/folder'
import { UserId } from '../../../../../types/user'
import { ProjectCompiler } from '../../../../../types/project-settings'

export const rootFolderId = '012345678901234567890123'
export const figuresFolderId = '123456789012345678901234'
export const figureId = '234567890123456789012345'
export const mockProject = ({
  projectFeatures = {},
  projectOwner = undefined,
  spellCheckLanguage = 'en',
  rootFolder = null,
}: any = {}) => {
  return {
    _id: 'test-project',
    name: 'Test Project',
    spellCheckLanguage,
    rootDocId: '_root_doc_id',
    rootFolder:
      rootFolder ||
      ([
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
              docs: [
                {
                  _id: 'fake-nested-doc-id',
                  name: 'foo.tex',
                },
              ],
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
      ] as Folder[]),
    features: {
      trackChanges: true,
      ...projectFeatures,
    },
    compiler: 'pdflatex' as ProjectCompiler,
    imageName: 'texlive-full:2024.1',
    trackChangesState: false,
    invites: [],
    members: [],
    owner: projectOwner || {
      _id: '124abd' as UserId,
      email: 'owner@example.com',
      first_name: 'Test',
      last_name: 'Owner',
      privileges: 'owner',
      signUpDate: new Date('2025-07-07').toISOString(),
    },
  }
}
