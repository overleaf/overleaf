// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */
import sinon from 'sinon'
import { get } from 'lodash'
import { SplitTestProvider } from '../../../frontend/js/shared/context/split-test-context'
import { IdeProvider } from '../../../frontend/js/shared/context/ide-context'
import { UserProvider } from '../../../frontend/js/shared/context/user-context'
import { ProjectProvider } from '../../../frontend/js/shared/context/project-context'
import { FileTreeDataProvider } from '../../../frontend/js/shared/context/file-tree-data-context'
import { EditorProvider } from '../../../frontend/js/shared/context/editor-context'
import { DetachProvider } from '../../../frontend/js/shared/context/detach-context'
import { LayoutProvider } from '../../../frontend/js/shared/context/layout-context'
import { LocalCompileProvider } from '../../../frontend/js/shared/context/local-compile-context'
import { DetachCompileProvider } from '../../../frontend/js/shared/context/detach-compile-context'

// these constants can be imported in tests instead of
// using magic strings
export const PROJECT_ID = 'project123'
export const PROJECT_NAME = 'project-name'

export function EditorProviders({
  user = { id: '123abd', email: 'testuser@example.com' },
  projectId = PROJECT_ID,
  rootDocId = '_root_doc_id',
  socket = {
    on: sinon.stub(),
    removeListener: sinon.stub(),
  },
  isRestrictedTokenMember = false,
  clsiServerId = '1234',
  scope = {},
  features = {
    referencesSearch: true,
  },
  permissionsLevel = 'owner',
  children,
  rootFolder = [
    {
      _id: 'root-folder-id',
      name: 'rootFolder',
      docs: [],
      folders: [],
      fileRefs: [],
    },
  ],
  ui = { view: null, pdfLayout: 'flat', chatOpen: true },
  fileTreeManager = {
    findEntityById: () => null,
    findEntityByPath: () => null,
    getEntityPath: () => '',
    getRootDocDirname: () => '',
  },
  editorManager = {
    getCurrentDocId: () => 'foo',
    getCurrentDocValue: () => {},
    openDoc: sinon.stub(),
  },
}) {
  window.user = user || window.user
  window.gitBridgePublicBaseUrl = 'git.overleaf.test'
  window.project_id = projectId != null ? projectId : window.project_id
  window.isRestrictedTokenMember = isRestrictedTokenMember

  const $scope = {
    user: window.user,
    project: {
      _id: window.project_id,
      name: PROJECT_NAME,
      owner: {
        _id: '124abd',
        email: 'owner@example.com',
      },
      features,
      rootDoc_id: rootDocId,
      rootFolder,
    },
    ui,
    $watch: (path, callback) => {
      callback(get($scope, path))
      return () => null
    },
    $on: sinon.stub(),
    $applyAsync: sinon.stub(),
    toggleHistory: sinon.stub(),
    permissionsLevel,
    ...scope,
  }

  const metadataManager = {
    metadata: {
      state: {
        documents: {},
      },
    },
  }

  window._ide = {
    $scope,
    socket,
    clsiServerId,
    editorManager,
    fileTreeManager,
    metadataManager,
  }

  return (
    <SplitTestProvider>
      <IdeProvider ide={window._ide}>
        <UserProvider>
          <ProjectProvider>
            <FileTreeDataProvider>
              <EditorProvider settings={{}}>
                <DetachProvider>
                  <LayoutProvider>
                    <LocalCompileProvider>
                      <DetachCompileProvider>{children}</DetachCompileProvider>
                    </LocalCompileProvider>
                  </LayoutProvider>
                </DetachProvider>
              </EditorProvider>
            </FileTreeDataProvider>
          </ProjectProvider>
        </UserProvider>
      </IdeProvider>
    </SplitTestProvider>
  )
}
