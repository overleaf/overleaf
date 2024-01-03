import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import PropTypes from 'prop-types'
import useScopeValue from '../hooks/use-scope-value'
import useBrowserWindow from '../hooks/use-browser-window'
import { useIdeContext } from './ide-context'
import { useProjectContext } from './project-context'
import { useDetachContext } from './detach-context'
import getMeta from '../../utils/meta'
import { useUserContext } from './user-context'
import { saveProjectSettings } from '@/features/editor-left-menu/utils/api'

export const EditorContext = createContext()

EditorContext.Provider.propTypes = {
  value: PropTypes.shape({
    cobranding: PropTypes.shape({
      logoImgUrl: PropTypes.string.isRequired,
      brandVariationName: PropTypes.string.isRequired,
      brandVariationId: PropTypes.number.isRequired,
      brandId: PropTypes.number.isRequired,
      brandVariationHomeUrl: PropTypes.string.isRequired,
      publishGuideHtml: PropTypes.string,
      partner: PropTypes.string,
      brandedMenu: PropTypes.bool,
      submitBtnHtml: PropTypes.string,
    }),
    hasPremiumCompile: PropTypes.bool,
    loading: PropTypes.bool,
    renameProject: PropTypes.func.isRequired,
    showSymbolPalette: PropTypes.bool,
    toggleSymbolPalette: PropTypes.func,
    insertSymbol: PropTypes.func,
    isProjectOwner: PropTypes.bool,
    isRestrictedTokenMember: PropTypes.bool,
    permissionsLevel: PropTypes.oneOf(['readOnly', 'readAndWrite', 'owner']),
  }),
}

export function EditorProvider({ children }) {
  const ide = useIdeContext()
  const { id: userId } = useUserContext()
  const { role } = useDetachContext()

  const {
    owner,
    features,
    _id: projectId,
  } = useProjectContext({
    owner: PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
    features: PropTypes.shape({
      compileGroup: PropTypes.string,
    }),
    _id: PropTypes.string.isRequired,
  })

  const cobranding = useMemo(() => {
    if (window.brandVariation) {
      return {
        logoImgUrl: window.brandVariation.logo_url,
        brandVariationName: window.brandVariation.name,
        brandVariationId: window.brandVariation.id,
        brandId: window.brandVariation.brand_id,
        brandVariationHomeUrl: window.brandVariation.home_url,
        publishGuideHtml: window.brandVariation.publish_guide_html,
        partner: window.brandVariation.partner,
        brandedMenu: window.brandVariation.branded_menu,
        submitBtnHtml: window.brandVariation.submit_button_html,
      }
    } else {
      return undefined
    }
  }, [])

  const [loading] = useScopeValue('state.loading')
  const [projectName, setProjectName] = useScopeValue('project.name')
  const [permissionsLevel, setPermissionsLevel] =
    useScopeValue('permissionsLevel')
  const [showSymbolPalette] = useScopeValue('editor.showSymbolPalette')
  const [toggleSymbolPalette] = useScopeValue('editor.toggleSymbolPalette')

  const [inactiveTutorials, setInactiveTutorials] = useState(() =>
    getMeta('ol-inactiveTutorials', [])
  )

  const [currentPopup, setCurrentPopup] = useState(null)

  const deactivateTutorial = useCallback(
    tutorialKey => {
      setInactiveTutorials([...inactiveTutorials, tutorialKey])
    },
    [inactiveTutorials]
  )

  useEffect(() => {
    if (ide?.socket) {
      ide.socket.on('projectNameUpdated', setProjectName)
      return () =>
        ide.socket.removeListener('projectNameUpdated', setProjectName)
    }
  }, [ide?.socket, setProjectName])

  const renameProject = useCallback(
    newName => {
      setProjectName(oldName => {
        if (oldName !== newName) {
          saveProjectSettings(projectId, { name: newName }).catch(response => {
            setProjectName(oldName)
            const { data, status } = response
            if (status === 400) {
              return ide.showGenericMessageModal('Error renaming project', data)
            } else {
              return ide.showGenericMessageModal(
                'Error renaming project',
                'Please try again in a moment'
              )
            }
          })
        }
        return newName
      })
    },
    [ide, setProjectName, projectId]
  )

  const { setTitle } = useBrowserWindow()
  useEffect(() => {
    const parts = []

    if (role === 'detached') {
      parts.push('[PDF]')
    }

    if (projectName) {
      parts.push(projectName)
      parts.push('-')
    }

    parts.push('Online LaTeX Editor')
    parts.push(window.ExposedSettings.appName)

    const title = parts.join(' ')

    setTitle(title)
  }, [projectName, setTitle, role])

  const insertSymbol = useCallback(symbol => {
    window.dispatchEvent(
      new CustomEvent('editor:insert-symbol', {
        detail: symbol,
      })
    )
  }, [])

  const value = useMemo(
    () => ({
      cobranding,
      hasPremiumCompile: features?.compileGroup === 'priority',
      loading,
      renameProject,
      permissionsLevel,
      setPermissionsLevel,
      isProjectOwner: owner?._id === userId,
      isRestrictedTokenMember: getMeta('ol-isRestrictedTokenMember'),
      showSymbolPalette,
      toggleSymbolPalette,
      insertSymbol,
      inactiveTutorials,
      deactivateTutorial,
      currentPopup,
      setCurrentPopup,
    }),
    [
      cobranding,
      features?.compileGroup,
      owner,
      userId,
      loading,
      renameProject,
      permissionsLevel,
      setPermissionsLevel,
      showSymbolPalette,
      toggleSymbolPalette,
      insertSymbol,
      inactiveTutorials,
      deactivateTutorial,
      currentPopup,
      setCurrentPopup,
    ]
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}

EditorProvider.propTypes = {
  children: PropTypes.any,
}

export function useEditorContext(propTypes) {
  const context = useContext(EditorContext)

  if (!context) {
    throw new Error('useEditorContext is only available inside EditorProvider')
  }

  PropTypes.checkPropTypes(propTypes, context, 'data', 'EditorContext.Provider')

  return context
}
