import PropTypes from 'prop-types'
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
import { getMockIde } from '@/shared/context/mock/mock-ide'

export function ContextRoot({ children, ide }) {
  return (
    <SplitTestProvider>
      <IdeAngularProvider ide={ide || getMockIde()}>
        <UserProvider>
          <ProjectProvider>
            <FileTreeDataProvider>
              <DetachProvider>
                <EditorProvider>
                  <ProjectSettingsProvider>
                    <LayoutProvider>
                      <LocalCompileProvider>
                        <DetachCompileProvider>
                          <ChatProvider>{children}</ChatProvider>
                        </DetachCompileProvider>
                      </LocalCompileProvider>
                    </LayoutProvider>
                  </ProjectSettingsProvider>
                </EditorProvider>
              </DetachProvider>
            </FileTreeDataProvider>
          </ProjectProvider>
        </UserProvider>
      </IdeAngularProvider>
    </SplitTestProvider>
  )
}

ContextRoot.propTypes = {
  children: PropTypes.any,
  ide: PropTypes.object,
}

export const rootContext = createSharedContext(ContextRoot)
