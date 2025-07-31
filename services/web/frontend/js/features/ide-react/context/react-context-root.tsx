import React, { FC, PropsWithChildren } from 'react'
import { ChatProvider } from '@/features/chat/context/chat-context'
import { ConnectionProvider } from './connection-context'
import { DetachCompileProvider } from '@/shared/context/detach-compile-context'
import { DetachProvider } from '@/shared/context/detach-context'
import { EditorManagerProvider } from '@/features/ide-react/context/editor-manager-context'
import { EditorOpenDocProvider } from '@/features/ide-react/context/editor-open-doc-context'
import { EditorPropertiesProvider } from '@/features/ide-react/context/editor-properties-context'
import { EditorProvider } from '@/shared/context/editor-context'
import { EditorViewProvider } from '@/features/ide-react/context/editor-view-context'
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
import { UserFeaturesProvider } from '@/shared/context/user-features-context'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'
import { IdeRedesignSwitcherProvider } from './ide-redesign-switcher-context'
import { CommandRegistryProvider } from './command-registry-context'

export const ReactContextRoot: FC<
  React.PropsWithChildren<{
    providers?: Record<string, FC<PropsWithChildren>>
  }>
> = ({ children, providers = {} }) => {
  const Providers = {
    ChatProvider,
    ConnectionProvider,
    DetachCompileProvider,
    DetachProvider,
    EditorManagerProvider,
    EditorOpenDocProvider,
    EditorPropertiesProvider,
    EditorProvider,
    EditorViewProvider,
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
    IdeRedesignSwitcherProvider,
    CommandRegistryProvider,
    UserFeaturesProvider,
    ...providers,
  }

  return (
    <Providers.SplitTestProvider>
      <Providers.ModalsContextProvider>
        <Providers.ConnectionProvider>
          <Providers.ProjectProvider>
            <Providers.IdeReactProvider>
              <Providers.UserProvider>
                <Providers.UserSettingsProvider>
                  <Providers.SnapshotProvider>
                    <Providers.DetachProvider>
                      <Providers.EditorPropertiesProvider>
                        <Providers.EditorViewProvider>
                          <Providers.EditorOpenDocProvider>
                            <Providers.EditorProvider>
                              <Providers.FileTreeDataProvider>
                                <Providers.FileTreePathProvider>
                                  <Providers.ReferencesProvider>
                                    <Providers.UserFeaturesProvider>
                                      <Providers.PermissionsProvider>
                                        <Providers.RailProvider>
                                          <Providers.LayoutProvider>
                                            <Providers.ProjectSettingsProvider>
                                              <Providers.EditorManagerProvider>
                                                <Providers.LocalCompileProvider>
                                                  <Providers.DetachCompileProvider>
                                                    <Providers.ChatProvider>
                                                      <Providers.FileTreeOpenProvider>
                                                        <Providers.OnlineUsersProvider>
                                                          <Providers.MetadataProvider>
                                                            <Providers.OutlineProvider>
                                                              <Providers.IdeRedesignSwitcherProvider>
                                                                <Providers.CommandRegistryProvider>
                                                                  {children}
                                                                </Providers.CommandRegistryProvider>
                                                              </Providers.IdeRedesignSwitcherProvider>
                                                            </Providers.OutlineProvider>
                                                          </Providers.MetadataProvider>
                                                        </Providers.OnlineUsersProvider>
                                                      </Providers.FileTreeOpenProvider>
                                                    </Providers.ChatProvider>
                                                  </Providers.DetachCompileProvider>
                                                </Providers.LocalCompileProvider>
                                              </Providers.EditorManagerProvider>
                                            </Providers.ProjectSettingsProvider>
                                          </Providers.LayoutProvider>
                                        </Providers.RailProvider>
                                      </Providers.PermissionsProvider>
                                    </Providers.UserFeaturesProvider>
                                  </Providers.ReferencesProvider>
                                </Providers.FileTreePathProvider>
                              </Providers.FileTreeDataProvider>
                            </Providers.EditorProvider>
                          </Providers.EditorOpenDocProvider>
                        </Providers.EditorViewProvider>
                      </Providers.EditorPropertiesProvider>
                    </Providers.DetachProvider>
                  </Providers.SnapshotProvider>
                </Providers.UserSettingsProvider>
              </Providers.UserProvider>
            </Providers.IdeReactProvider>
          </Providers.ProjectProvider>
        </Providers.ConnectionProvider>
      </Providers.ModalsContextProvider>
    </Providers.SplitTestProvider>
  )
}
