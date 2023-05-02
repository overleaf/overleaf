import { createContext, useContext, useMemo } from 'react'
import PropTypes from 'prop-types'
import useScopeValue from '../hooks/use-scope-value'

const ProjectContext = createContext()

export const projectShape = {
  _id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  rootDocId: PropTypes.string,
  members: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    })
  ),
  invites: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
    })
  ),
  features: PropTypes.shape({
    collaborators: PropTypes.number,
    compileGroup: PropTypes.oneOf(['alpha', 'standard', 'priority']),
    trackChangesVisible: PropTypes.bool,
    references: PropTypes.bool,
    mendeley: PropTypes.bool,
    zotero: PropTypes.bool,
    versioning: PropTypes.bool,
  }),
  publicAccessLevel: PropTypes.string,
  tokens: PropTypes.shape({
    readOnly: PropTypes.string,
    readAndWrite: PropTypes.string,
  }),
  owner: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    email: PropTypes.string.isRequired,
  }),
}

ProjectContext.Provider.propTypes = {
  value: PropTypes.shape(projectShape),
}

export function useProjectContext(propTypes) {
  const context = useContext(ProjectContext)

  if (!context) {
    throw new Error(
      'useProjectContext is only available inside ProjectProvider'
    )
  }

  PropTypes.checkPropTypes(
    propTypes,
    context,
    'data',
    'ProjectContext.Provider'
  )

  return context
}

// when the provider is created the project is still not added to the Angular
// scope. A few props are populated to prevent errors in existing React
// components
const projectFallback = {
  _id: window.project_id,
  name: '',
  features: {},
}

export function ProjectProvider({ children }) {
  const [project] = useScopeValue('project', true)

  const {
    _id,
    name,
    rootDoc_id: rootDocId,
    members,
    invites,
    features,
    publicAccesLevel: publicAccessLevel,
    tokens,
    owner,
  } = project || projectFallback

  const value = useMemo(() => {
    return {
      _id,
      name,
      rootDocId,
      members,
      invites,
      features,
      publicAccessLevel,
      tokens,
      owner,
    }
  }, [
    _id,
    name,
    rootDocId,
    members,
    invites,
    features,
    publicAccessLevel,
    tokens,
    owner,
  ])

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}

ProjectProvider.propTypes = {
  children: PropTypes.any,
}
