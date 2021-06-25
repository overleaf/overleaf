import PropTypes from 'prop-types'
import createSharedContext from 'react2angular-shared-context'

import { UserProvider } from './user-context'
import { IdeProvider } from './ide-context'
import { EditorProvider } from './editor-context'
import { CompileProvider } from './compile-context'
import { LayoutProvider } from './layout-context'
import { ChatProvider } from '../../features/chat/context/chat-context'
import { ProjectProvider } from './project-context'

export function ContextRoot({ children, ide, settings }) {
  return (
    <IdeProvider ide={ide}>
      <UserProvider>
        <ProjectProvider>
          <EditorProvider settings={settings}>
            <CompileProvider>
              <LayoutProvider>
                <ChatProvider>{children}</ChatProvider>
              </LayoutProvider>
            </CompileProvider>
          </EditorProvider>
        </ProjectProvider>
      </UserProvider>
    </IdeProvider>
  )
}

ContextRoot.propTypes = {
  children: PropTypes.any,
  ide: PropTypes.any.isRequired,
  settings: PropTypes.any.isRequired,
}

export const rootContext = createSharedContext(ContextRoot)
