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
import { ProjectSettingsProvider } from '../../../frontend/js/features/editor-left-menu/context/project-settings-context'

// these constants can be imported in tests instead of
// using magic strings
export const PROJECT_ID = 'project123'
export const PROJECT_NAME = 'project-name'
export const USER_ID = '123abd'
export const USER_EMAIL = 'testuser@example.com'

export function EditorProviders({
  user = { id: USER_ID, email: USER_EMAIL },
  projectId = PROJECT_ID,
  projectOwner = {
    _id: '124abd',
    email: 'owner@example.com',
  },
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
  ui = { view: 'editor', pdfLayout: 'sideBySide', chatOpen: true },
  fileTreeManager = {
    findEntityById: () => null,
    findEntityByPath: () => null,
    getEntityPath: () => '',
    getRootDocDirname: () => '',
    getPreviewByPath: path => ({ url: path, extension: 'png' }),
  },
  editorManager = {
    getCurrentDocId: () => 'foo',
    getCurrentDocValue: () => {},
    openDoc: sinon.stub(),
  },
  metadataManager = {
    metadata: {
      state: {
        documents: {},
      },
    },
  },
}) {
  window.user = user || window.user
  window.gitBridgePublicBaseUrl = 'https://git.overleaf.test'
  window.project_id = projectId != null ? projectId : window.project_id
  window.isRestrictedTokenMember = isRestrictedTokenMember

  const $scope = {
    user: window.user,
    project: {
      _id: window.project_id,
      name: PROJECT_NAME,
      owner: projectOwner,
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

  window._ide = {
    $scope,
    socket,
    clsiServerId,
    editorManager,
    fileTreeManager,
    metadataManager,
  }

  // Add details for useUserContext
  window.metaAttributesCache.set('ol-user', { ...user, features })

  return (
    <SplitTestProvider>
      <IdeProvider ide={window._ide}>
        <UserProvider>
          <ProjectProvider>
            <FileTreeDataProvider>
              <DetachProvider>
                <EditorProvider settings={{}}>
                  <ProjectSettingsProvider>
                    <LayoutProvider>
                      <LocalCompileProvider>
                        <DetachCompileProvider>
                          {children}
                        </DetachCompileProvider>
                      </LocalCompileProvider>
                    </LayoutProvider>
                  </ProjectSettingsProvider>
                </EditorProvider>
              </DetachProvider>
            </FileTreeDataProvider>
          </ProjectProvider>
        </UserProvider>
      </IdeProvider>
    </SplitTestProvider>
  )
}
