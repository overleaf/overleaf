import React, { createContext, useCallback, useContext, useEffect } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from './util/scope-value-hook'
import { useApplicationContext } from './application-context'
import useBrowserWindow from '../hooks/use-browser-window'

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
    projectRootDocId: PropTypes.string,
    projectId: PropTypes.string.isRequired,
    projectName: PropTypes.string.isRequired,
    renameProject: PropTypes.func.isRequired,
    isProjectOwner: PropTypes.bool,
    isRestrictedTokenMember: PropTypes.bool,
    rootFolder: PropTypes.object,
  }),
}

export function EditorProvider({ children, ide, settings }) {
  const {
    exposedSettings: { appName },
  } = useApplicationContext({
    exposedSettings: PropTypes.shape({ appName: PropTypes.string.isRequired })
      .isRequired,
  })

  const cobranding = window.brandVariation
    ? {
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
    : undefined

  const ownerId =
    ide.$scope.project && ide.$scope.project.owner
      ? ide.$scope.project.owner._id
      : null

  const [loading] = useScopeValue('state.loading', ide.$scope)

  const [projectRootDocId] = useScopeValue('project.rootDoc_id', ide.$scope)

  const [projectName, setProjectName] = useScopeValue(
    'project.name',
    ide.$scope
  )

  const [compileGroup] = useScopeValue(
    'project.features.compileGroup',
    ide.$scope
  )

  const [rootFolder] = useScopeValue('rootFolder', ide.$scope)

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
      `${projectName ? projectName + ' - ' : ''}Online LaTeX Editor ${appName}`
    )
  }, [appName, projectName, setTitle])

  const editorContextValue = {
    cobranding,
    hasPremiumCompile: compileGroup === 'priority',
    loading,
    projectId: window.project_id,
    projectRootDocId,
    projectName: projectName || '', // initially might be empty in Angular
    renameProject,
    isProjectOwner: ownerId === window.user.id,
    isRestrictedTokenMember: window.isRestrictedTokenMember,
    rootFolder,
  }

  return (
    <>
      <EditorContext.Provider value={editorContextValue}>
        {children}
      </EditorContext.Provider>
    </>
  )
}

EditorProvider.propTypes = {
  children: PropTypes.any,
  ide: PropTypes.any.isRequired,
  settings: PropTypes.any.isRequired,
}

export function useEditorContext(propTypes) {
  const data = useContext(EditorContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'EditorContext.Provider')
  return data
}
