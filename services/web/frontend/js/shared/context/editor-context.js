import React, { createContext, useCallback, useContext } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from './util/scope-value-hook'
import { useApplicationContext } from './application-context'
import useBrowserWindow from '../../infrastructure/browser-window-hook'

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
    projectName: PropTypes.string.isRequired,
    renameProject: PropTypes.func.isRequired,
    isProjectOwner: PropTypes.bool,
    isRestrictedTokenMember: PropTypes.bool
  })
}

export function EditorProvider({ children, ide, settings }) {
  const {
    exposedSettings: { appName }
  } = useApplicationContext({
    exposedSettings: PropTypes.shape({ appName: PropTypes.string.isRequired })
      .isRequired
  })

  const cobranding = window.brandVariation
    ? {
        logoImgUrl: window.brandVariation.logo_url,
        brandVariationName: window.brandVariation.name,
        brandVariationHomeUrl: window.brandVariation.home_url
      }
    : undefined

  const ownerId =
    ide.$scope.project && ide.$scope.project.owner
      ? ide.$scope.project.owner._id
      : null

  const [loading] = useScopeValue('state.loading', ide.$scope)

  const [projectName, setProjectName] = useScopeValue(
    'project.name',
    ide.$scope
  )

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
  setTitle(
    `${projectName ? projectName + ' - ' : ''}Online LaTeX Editor ${appName}`
  )

  const editorContextValue = {
    cobranding,
    loading,
    projectId: window.project_id,
    projectName: projectName || '', // initially might be empty in Angular
    renameProject,
    isProjectOwner: ownerId === window.user.id,
    isRestrictedTokenMember: window.isRestrictedTokenMember
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
  settings: PropTypes.any.isRequired
}

export function useEditorContext(propTypes) {
  const data = useContext(EditorContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'EditorContext.Provider')
  return data
}
