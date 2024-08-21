import { FC } from 'react'
import { ConnectionProvider } from './connection-context'
import { IdeReactProvider } from '@/features/ide-react/context/ide-react-context'
import { LayoutProvider } from '@/shared/context/layout-context'
import { DetachProvider } from '@/shared/context/detach-context'
import { ProjectProvider } from '@/shared/context/project-context'
import { ProjectSettingsProvider } from '@/features/editor-left-menu/context/project-settings-context'
import { EditorProvider } from '@/shared/context/editor-context'
import { UserProvider } from '@/shared/context/user-context'
import { EditorManagerProvider } from '@/features/ide-react/context/editor-manager-context'
import { FileTreeDataProvider } from '@/shared/context/file-tree-data-context'
import { DetachCompileProvider } from '@/shared/context/detach-compile-context'
import { ChatProvider } from '@/features/chat/context/chat-context'
import { LocalCompileProvider } from '@/shared/context/local-compile-context'
import { OnlineUsersProvider } from '@/features/ide-react/context/online-users-context'
import { MetadataProvider } from '@/features/ide-react/context/metadata-context'
import { ReferencesProvider } from '@/features/ide-react/context/references-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { ModalsContextProvider } from '@/features/ide-react/context/modals-context'
import { FileTreePathProvider } from '@/features/file-tree/contexts/file-tree-path'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'
import { PermissionsProvider } from '@/features/ide-react/context/permissions-context'
import { FileTreeOpenProvider } from '@/features/ide-react/context/file-tree-open-context'
import { OutlineProvider } from '@/features/ide-react/context/outline-context'
import { SnapshotProvider } from '@/features/ide-react/context/snapshot-context'

export const ReactContextRoot: FC = ({ children }) => {
  return (
    <SplitTestProvider>
      <ModalsContextProvider>
        <ConnectionProvider>
          <IdeReactProvider>
            <UserProvider>
              <UserSettingsProvider>
                <ProjectProvider>
                  <SnapshotProvider>
                    <FileTreeDataProvider>
                      <FileTreePathProvider>
                        <ReferencesProvider>
                          <DetachProvider>
                            <EditorProvider>
                              <PermissionsProvider>
                                <ProjectSettingsProvider>
                                  <LayoutProvider>
                                    <EditorManagerProvider>
                                      <LocalCompileProvider>
                                        <DetachCompileProvider>
                                          <ChatProvider>
                                            <FileTreeOpenProvider>
                                              <OnlineUsersProvider>
                                                <MetadataProvider>
                                                  <OutlineProvider>
                                                    {children}
                                                  </OutlineProvider>
                                                </MetadataProvider>
                                              </OnlineUsersProvider>
                                            </FileTreeOpenProvider>
                                          </ChatProvider>
                                        </DetachCompileProvider>
                                      </LocalCompileProvider>
                                    </EditorManagerProvider>
                                  </LayoutProvider>
                                </ProjectSettingsProvider>
                              </PermissionsProvider>
                            </EditorProvider>
                          </DetachProvider>
                        </ReferencesProvider>
                      </FileTreePathProvider>
                    </FileTreeDataProvider>
                  </SnapshotProvider>
                </ProjectProvider>
              </UserSettingsProvider>
            </UserProvider>
          </IdeReactProvider>
        </ConnectionProvider>
      </ModalsContextProvider>
    </SplitTestProvider>
  )
}
