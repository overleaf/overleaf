import React, { ElementType, FC, PropsWithChildren } from 'react'
import { ChatProvider } from '@/features/chat/context/chat-context'
import { ChangesUsersProvider } from '@/shared/context/changes-users-context'
import { ConnectionProvider } from './connection-context'
import { DeepLinkProvider } from '@/features/ide-react/context/deep-link-context'
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
import { RailProvider } from '@/features/ide-react/context/rail-context'
import { ProjectSettingsProvider } from '@/features/ide-settings/context/project-settings-context'
import { ReferencesProvider } from '@/features/ide-react/context/references-context'
import { SnapshotProvider } from '@/features/ide-react/context/snapshot-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { UserProvider } from '@/shared/context/user-context'
import { UserFeaturesProvider } from '@/shared/context/user-features-context'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'
import { CommandRegistryProvider } from './command-registry-context'
import { EditorSelectionProvider } from '@/shared/context/editor-selection-context'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import { TutorialProvider } from '@/shared/context/tutorial-context'
import { TabsProvider } from './tabs-context'
import { UnsavedDocsProvider } from '@/features/ide-react/context/unsaved-docs-context'

const rootContextProviders = importOverleafModules('rootContextProviders') as {
  import: { default: ElementType }
  path: string
}[]

export const ReactContextRoot: FC<
  React.PropsWithChildren<{
    providers?: Record<string, FC<PropsWithChildren>>
  }>
> = ({ children, providers = {} }) => {
  const Providers = {
    ChatProvider,
    ChangesUsersProvider,
    ConnectionProvider,
    DeepLinkProvider,
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
    CommandRegistryProvider,
    UserFeaturesProvider,
    EditorSelectionProvider,
    TutorialProvider,
    TabsProvider,
    UnsavedDocsProvider,
    ...providers,
  }

  // Extract dynamic providers from modules
  const dynamicProviders = rootContextProviders.map(
    module => module.import.default
  )

  // Wrap children with all dynamic providers from outside to inside
  const childrenWrappedWithDynamicProviders =
    dynamicProviders.reduceRight<React.ReactElement>(
      (acc, Provider) => <Provider>{acc}</Provider>,
      <>{children}</>
    )

  return (
    <Providers.DeepLinkProvider>
      <Providers.SplitTestProvider>
        <Providers.ModalsContextProvider>
          <Providers.ConnectionProvider>
            <Providers.ProjectProvider>
              <Providers.UserSettingsProvider>
                <Providers.IdeReactProvider>
                  <Providers.UserProvider>
                    <Providers.SnapshotProvider>
                      <Providers.DetachProvider>
                        <Providers.EditorOpenDocProvider>
                          <Providers.EditorViewProvider>
                            <Providers.EditorPropertiesProvider>
                              <Providers.EditorProvider>
                                <Providers.TutorialProvider>
                                  <Providers.FileTreeDataProvider>
                                    <Providers.FileTreePathProvider>
                                      <Providers.UserFeaturesProvider>
                                        <Providers.PermissionsProvider>
                                          <Providers.RailProvider>
                                            <Providers.LayoutProvider>
                                              <Providers.ProjectSettingsProvider>
                                                <Providers.EditorManagerProvider>
                                                  <Providers.UnsavedDocsProvider>
                                                    <Providers.ReferencesProvider>
                                                      <Providers.LocalCompileProvider>
                                                        <Providers.DetachCompileProvider>
                                                          <Providers.ChatProvider>
                                                            <Providers.FileTreeOpenProvider>
                                                              <Providers.TabsProvider>
                                                                <Providers.OnlineUsersProvider>
                                                                  <Providers.MetadataProvider>
                                                                    <Providers.OutlineProvider>
                                                                      <Providers.CommandRegistryProvider>
                                                                        <Providers.EditorSelectionProvider>
                                                                          <Providers.ChangesUsersProvider>
                                                                            {
                                                                              childrenWrappedWithDynamicProviders
                                                                            }
                                                                          </Providers.ChangesUsersProvider>
                                                                        </Providers.EditorSelectionProvider>
                                                                      </Providers.CommandRegistryProvider>
                                                                    </Providers.OutlineProvider>
                                                                  </Providers.MetadataProvider>
                                                                </Providers.OnlineUsersProvider>
                                                              </Providers.TabsProvider>
                                                            </Providers.FileTreeOpenProvider>
                                                          </Providers.ChatProvider>
                                                        </Providers.DetachCompileProvider>
                                                      </Providers.LocalCompileProvider>
                                                    </Providers.ReferencesProvider>
                                                  </Providers.UnsavedDocsProvider>
                                                </Providers.EditorManagerProvider>
                                              </Providers.ProjectSettingsProvider>
                                            </Providers.LayoutProvider>
                                          </Providers.RailProvider>
                                        </Providers.PermissionsProvider>
                                      </Providers.UserFeaturesProvider>
                                    </Providers.FileTreePathProvider>
                                  </Providers.FileTreeDataProvider>
                                </Providers.TutorialProvider>
                              </Providers.EditorProvider>
                            </Providers.EditorPropertiesProvider>
                          </Providers.EditorViewProvider>
                        </Providers.EditorOpenDocProvider>
                      </Providers.DetachProvider>
                    </Providers.SnapshotProvider>
                  </Providers.UserProvider>
                </Providers.IdeReactProvider>
              </Providers.UserSettingsProvider>
            </Providers.ProjectProvider>
          </Providers.ConnectionProvider>
        </Providers.ModalsContextProvider>
      </Providers.SplitTestProvider>
    </Providers.DeepLinkProvider>
  )
}
