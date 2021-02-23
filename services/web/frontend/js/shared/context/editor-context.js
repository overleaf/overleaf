import React, { createContext, useContext } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from './util/scope-value-hook'

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
    isProjectOwner: PropTypes.bool,
    isRestrictedTokenMember: PropTypes.bool
  })
}

export function EditorProvider({ children, $scope }) {
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

  const [loading] = useScopeValue('state.loading', $scope)

  const editorContextValue = {
    cobranding,
    loading,
    projectId: window.project_id,
    isProjectOwner: ownerId === window.user.id,
    isRestrictedTokenMember: window.isRestrictedTokenMember
  }

  return (
    <EditorContext.Provider value={editorContextValue}>
      {children}
    </EditorContext.Provider>
  )
}

EditorProvider.propTypes = {
  children: PropTypes.any,
  $scope: PropTypes.any.isRequired
}

export function useEditorContext(propTypes) {
  const data = useContext(EditorContext)
  PropTypes.checkPropTypes(propTypes, data, 'data', 'EditorContext.Provider')
  return data
}
