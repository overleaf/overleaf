import PropTypes from 'prop-types'
import createSharedContext from 'react2angular-shared-context'

import { UserProvider } from './user-context'
import { IdeProvider } from './ide-context'
import { EditorProvider } from './editor-context'
import { CompileProvider } from './compile-context'
import { LayoutProvider } from './layout-context'
import { DetachProvider } from './detach-context'
import { ChatProvider } from '../../features/chat/context/chat-context'
import { ProjectProvider } from './project-context'
import { SplitTestProvider } from './split-test-context'

export function ContextRoot({ children, ide, settings }) {
  return (
    <SplitTestProvider>
      <IdeProvider ide={ide}>
        <UserProvider>
          <ProjectProvider>
            <EditorProvider settings={settings}>
              <DetachProvider>
                <LayoutProvider>
                  <CompileProvider>
                    <ChatProvider>{children}</ChatProvider>
                  </CompileProvider>
                </LayoutProvider>
              </DetachProvider>
            </EditorProvider>
          </ProjectProvider>
        </UserProvider>
      </IdeProvider>
    </SplitTestProvider>
  )
}

ContextRoot.propTypes = {
  children: PropTypes.any,
  ide: PropTypes.any.isRequired,
  settings: PropTypes.any.isRequired,
}

export const rootContext = createSharedContext(ContextRoot)
