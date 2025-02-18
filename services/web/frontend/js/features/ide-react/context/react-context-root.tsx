import { FC } from 'react'
import { ChatProvider } from '@/features/chat/context/chat-context'
import { ConnectionProvider } from './connection-context'
import { DetachCompileProvider } from '@/shared/context/detach-compile-context'
import { DetachProvider } from '@/shared/context/detach-context'
import { EditorManagerProvider } from '@/features/ide-react/context/editor-manager-context'
import { EditorProvider } from '@/shared/context/editor-context'
import { FileTreeDataProvider } from '@/shared/context/file-tree-data-context'
import { FileTreeOpenProvider } from '@/features/ide-react/context/file-tree-open-context'
import { FileTreePathProvider } from '@/features/file-tree/contexts/file-tree-path'
import { IdeReactProvider } from '@/features/ide-react/context/ide-react-context'
import { LayoutProvider } from '@/shared/context/layout-context'
import { LocalCompileProvider } from '@/shared/context/local-compile-context'
import { MetadataProvider } from '@/features/ide-react/context/metadata-context'
import { ModalsContextProvider } from '@/features/ide-react/context/modals-context'
import { OnlineUsersProvider } from '@/features/ide-react/context/online-users-context'
import { OutlineProvider } from '@/features/ide-react/context/outline-context'
import { PermissionsProvider } from '@/features/ide-react/context/permissions-context'
import { ProjectProvider } from '@/shared/context/project-context'
import { RailProvider } from '@/features/ide-redesign/contexts/rail-context'
import { ProjectSettingsProvider } from '@/features/editor-left-menu/context/project-settings-context'
import { ReferencesProvider } from '@/features/ide-react/context/references-context'
import { SnapshotProvider } from '@/features/ide-react/context/snapshot-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { UserProvider } from '@/shared/context/user-context'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'

export const ReactContextRoot: FC<{ providers?: Record<string, FC> }> = ({
  children,
  providers = {},
}) => {
  const Providers = {
    ChatProvider,
    ConnectionProvider,
    DetachCompileProvider,
    DetachProvider,
    EditorManagerProvider,
    EditorProvider,
    FileTreeDataProvider,
    FileTreeOpenProvider,
    FileTreePathProvider,
    IdeReactProvider,
    LayoutProvider,
    LocalCompileProvider,
    MetadataProvider,
    ModalsContextProvider,
    OnlineUsersProvider,
    OutlineProvider,
    PermissionsProvider,
    ProjectProvider,
    ProjectSettingsProvider,
    RailProvider,
    ReferencesProvider,
    SnapshotProvider,
    SplitTestProvider,
    UserProvider,
    UserSettingsProvider,
    ...providers,
  }

  return (
    <Providers.SplitTestProvider>
      <Providers.ModalsContextProvider>
        <Providers.ConnectionProvider>
          <Providers.IdeReactProvider>
            <Providers.UserProvider>
              <Providers.UserSettingsProvider>
                <Providers.ProjectProvider>
                  <Providers.SnapshotProvider>
                    <Providers.FileTreeDataProvider>
                      <Providers.FileTreePathProvider>
                        <Providers.ReferencesProvider>
                          <Providers.DetachProvider>
                            <Providers.EditorProvider>
                              <Providers.PermissionsProvider>
                                <Providers.ProjectSettingsProvider>
                                  <Providers.LayoutProvider>
                                    <Providers.EditorManagerProvider>
                                      <Providers.LocalCompileProvider>
                                        <Providers.DetachCompileProvider>
                                          <Providers.ChatProvider>
                                            <Providers.FileTreeOpenProvider>
                                              <Providers.OnlineUsersProvider>
                                                <Providers.MetadataProvider>
                                                  <Providers.OutlineProvider>
                                                    <Providers.RailProvider>
                                                      {children}
                                                    </Providers.RailProvider>
                                                  </Providers.OutlineProvider>
                                                </Providers.MetadataProvider>
                                              </Providers.OnlineUsersProvider>
                                            </Providers.FileTreeOpenProvider>
                                          </Providers.ChatProvider>
                                        </Providers.DetachCompileProvider>
                                      </Providers.LocalCompileProvider>
                                    </Providers.EditorManagerProvider>
                                  </Providers.LayoutProvider>
                                </Providers.ProjectSettingsProvider>
                              </Providers.PermissionsProvider>
                            </Providers.EditorProvider>
                          </Providers.DetachProvider>
                        </Providers.ReferencesProvider>
                      </Providers.FileTreePathProvider>
                    </Providers.FileTreeDataProvider>
                  </Providers.SnapshotProvider>
                </Providers.ProjectProvider>
              </Providers.UserSettingsProvider>
            </Providers.UserProvider>
          </Providers.IdeReactProvider>
        </Providers.ConnectionProvider>
      </Providers.ModalsContextProvider>
    </Providers.SplitTestProvider>
  )
}
