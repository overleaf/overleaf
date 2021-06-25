import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react'
import PropTypes from 'prop-types'
import useScopeValue from './util/scope-value-hook'
import useBrowserWindow from '../hooks/use-browser-window'
import { useIdeContext } from './ide-context'
import { useProjectContext } from './project-context'

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
      brandedMenu: PropTypes.string,
      submitBtnHtml: PropTypes.string,
    }),
    hasPremiumCompile: PropTypes.bool,
    loading: PropTypes.bool,
    renameProject: PropTypes.func.isRequired,
    isProjectOwner: PropTypes.bool,
    isRestrictedTokenMember: PropTypes.bool,
    rootFolder: PropTypes.shape({
      children: PropTypes.arrayOf(PropTypes.shape({ type: PropTypes.string })),
    }),
  }),
}

export function EditorProvider({ children, settings }) {
  const ide = useIdeContext()

  const { owner, features } = useProjectContext({
    owner: PropTypes.shape({
      _id: PropTypes.string.isRequired,
    }),
    features: PropTypes.shape({
      compileGroup: PropTypes.string,
    }),
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
  const [rootFolder] = useScopeValue('rootFolder')

  const renameProject = useCallback(
    newName => {
      setProjectName(oldName => {
        if (oldName !== newName) {
          settings.saveProjectSettings({ name: newName }).catch(response => {
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
    [settings, ide, setProjectName]
  )

  const { setTitle } = useBrowserWindow()
  useEffect(() => {
    setTitle(
      `${projectName ? projectName + ' - ' : ''}Online LaTeX Editor ${
        window.ExposedSettings.appName
      }`
    )
  }, [projectName, setTitle])

  const value = useMemo(
    () => ({
      cobranding,
      hasPremiumCompile: features?.compileGroup === 'priority',
      loading,
      renameProject,
      isProjectOwner: owner?._id === window.user.id,
      isRestrictedTokenMember: window.isRestrictedTokenMember,
      rootFolder,
    }),
    [
      cobranding,
      features?.compileGroup,
      loading,
      renameProject,
      owner?._id,
      rootFolder,
    ]
  )

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  )
}

EditorProvider.propTypes = {
  children: PropTypes.any,
  settings: PropTypes.any.isRequired,
}

export function useEditorContext(propTypes) {
  const context = useContext(EditorContext)

  if (!context) {
    throw new Error('useEditorContext is only available inside EditorProvider')
  }

  PropTypes.checkPropTypes(propTypes, context, 'data', 'EditorContext.Provider')

  return context
}
