import { FC } from 'react'
import createSharedContext from 'react2angular-shared-context'
import { UserProvider } from './user-context'
import { IdeAngularProvider } from './ide-angular-provider'
import { EditorProvider } from './editor-context'
import { LocalCompileProvider } from './local-compile-context'
import { DetachCompileProvider } from './detach-compile-context'
import { LayoutProvider } from './layout-context'
import { DetachProvider } from './detach-context'
import { ChatProvider } from '@/features/chat/context/chat-context'
import { ProjectProvider } from './project-context'
import { SplitTestProvider } from './split-test-context'
import { FileTreeDataProvider } from './file-tree-data-context'
import { ProjectSettingsProvider } from '@/features/editor-left-menu/context/project-settings-context'
import { FileTreePathProvider } from '@/features/file-tree/contexts/file-tree-path'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'
import { OutlineProvider } from '@/features/ide-react/context/outline-context'
import { Ide } from '@/shared/context/ide-context'

export const ContextRoot: FC<{ ide?: Ide }> = ({ children, ide }) => {
  return (
    <SplitTestProvider>
      <IdeAngularProvider ide={ide}>
        <UserProvider>
          <UserSettingsProvider>
            <ProjectProvider>
              <FileTreeDataProvider>
                <FileTreePathProvider>
                  <DetachProvider>
                    <EditorProvider>
                      <ProjectSettingsProvider>
                        <LayoutProvider>
                          <LocalCompileProvider>
                            <DetachCompileProvider>
                              <ChatProvider>
                                <OutlineProvider>{children}</OutlineProvider>
                              </ChatProvider>
                            </DetachCompileProvider>
                          </LocalCompileProvider>
                        </LayoutProvider>
                      </ProjectSettingsProvider>
                    </EditorProvider>
                  </DetachProvider>
                </FileTreePathProvider>
              </FileTreeDataProvider>
            </ProjectProvider>
          </UserSettingsProvider>
        </UserProvider>
      </IdeAngularProvider>
    </SplitTestProvider>
  )
}

export const rootContext = createSharedContext(ContextRoot)
