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

export const ReactContextRoot: FC = ({ children }) => {
  return (
    <SplitTestProvider>
      <ConnectionProvider>
        <IdeReactProvider>
          <UserProvider>
            <UserSettingsProvider>
              <ProjectProvider>
                <FileTreeDataProvider>
                  <FileTreePathProvider>
                    <ReferencesProvider>
                      <DetachProvider>
                        <EditorProvider>
                          <ProjectSettingsProvider>
                            <LayoutProvider>
                              <LocalCompileProvider>
                                <DetachCompileProvider>
                                  <ChatProvider>
                                    <ModalsContextProvider>
                                      <EditorManagerProvider>
                                        <OnlineUsersProvider>
                                          <MetadataProvider>
                                            {children}
                                          </MetadataProvider>
                                        </OnlineUsersProvider>
                                      </EditorManagerProvider>
                                    </ModalsContextProvider>
                                  </ChatProvider>
                                </DetachCompileProvider>
                              </LocalCompileProvider>
                            </LayoutProvider>
                          </ProjectSettingsProvider>
                        </EditorProvider>
                      </DetachProvider>
                    </ReferencesProvider>
                  </FileTreePathProvider>
                </FileTreeDataProvider>
              </ProjectProvider>
            </UserSettingsProvider>
          </UserProvider>
        </IdeReactProvider>
      </ConnectionProvider>
    </SplitTestProvider>
  )
}
