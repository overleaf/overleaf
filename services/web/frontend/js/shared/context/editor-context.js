import React, { createContext, useCallback, useContext, useEffect } from 'react'
import PropTypes from 'prop-types'
import usePersistedState from '../../infrastructure/persisted-state-hook'

export const EditorContext = createContext()

EditorContext.Provider.propTypes = {
  value: PropTypes.shape({
    cobranding: PropTypes.shape({
      logoImgUrl: PropTypes.string.isRequired,
      brandVariationName: PropTypes.string.isRequired,
      brandVariationHomeUrl: PropTypes.string.isRequired
    }),
    loading: PropTypes.bool,
    projectId: PropTypes.string.isRequired,
    isProjectOwner: PropTypes.bool
  })
}

export function EditorProvider({
  children,
  loading,
  chatIsOpenAngular,
  setChatIsOpenAngular
}) {
  const cobranding = window.brandVariation
    ? {
        logoImgUrl: window.brandVariation.logo_url,
        brandVariationName: window.brandVariation.name,
        brandVariationHomeUrl: window.brandVariation.home_url
      }
    : undefined

  const ownerId =
    window._ide.$scope.project && window._ide.$scope.project.owner
      ? window._ide.$scope.project.owner._id
      : null

  const [chatIsOpen, setChatIsOpen] = usePersistedState(
    'editor.ui.chat.open',
    false
  )

  const toggleChatOpen = useCallback(() => {
    setChatIsOpen(!chatIsOpen)
    setChatIsOpenAngular(!chatIsOpen)
  }, [chatIsOpen, setChatIsOpenAngular, setChatIsOpen])

  // updates React's `chatIsOpen` state when the chat is opened by Angular.
  // In order to prevent race conditions with `toggleChatOpen` it's not a 1:1 binding:
  // Angular forces the React state to `true`, but can only set it to `false` when
  // the React state is explicitly `true`.
  useEffect(() => {
    if (chatIsOpenAngular) {
      setChatIsOpen(true)
    } else if (chatIsOpen) {
      setChatIsOpen(false)
    }
  }, [chatIsOpenAngular, chatIsOpen, setChatIsOpen])

  const editorContextValue = {
    cobranding,
    loading,
    projectId: window.project_id,
    isProjectOwner: ownerId === window.user.id,
    ui: {
      chatIsOpen,
      toggleChatOpen
    }
  }

  return (
    <EditorContext.Provider value={editorContextValue}>
      {children}
    </EditorContext.Provider>
  )
}

EditorProvider.propTypes = {
  children: PropTypes.any,
  loading: PropTypes.bool,
  chatIsOpenAngular: PropTypes.bool,
  setChatIsOpenAngular: PropTypes.func.isRequired
}

export function useEditorContext(propTypes) {
  const data = useContext(EditorContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'EditorContext.Provider')
  return data
}
