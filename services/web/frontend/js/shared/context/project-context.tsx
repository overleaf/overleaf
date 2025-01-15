import { FC, createContext, useContext, useMemo, useState } from 'react'
import useScopeValue from '../hooks/use-scope-value'
import getMeta from '@/utils/meta'
import { ProjectContextValue } from './types/project-context'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

export function useProjectContext() {
  const context = useContext(ProjectContext)

  if (!context) {
    throw new Error(
      'useProjectContext is only available inside ProjectProvider'
    )
  }

  return context
}

// when the provider is created the project is still not added to the Angular
// scope. A few props are populated to prevent errors in existing React
// components
const projectFallback = {
  _id: getMeta('ol-project_id'),
  name: '',
  features: {},
}

export const ProjectProvider: FC = ({ children }) => {
  const [project] = useScopeValue('project')

  const {
    _id,
    compiler,
    name,
    rootDoc_id: rootDocId,
    members,
    invites,
    features,
    publicAccesLevel: publicAccessLevel,
    owner,
    trackChangesState,
    mainBibliographyDoc_id: mainBibliographyDocId,
  } = project || projectFallback

  const [projectSnapshot] = useState(() => new ProjectSnapshot(_id))

  const tags = useMemo(
    () =>
      (getMeta('ol-projectTags') || [])
        // `tag.name` data may be null for some old users
        .map((tag: any) => ({ ...tag, name: tag.name ?? '' })),
    []
  )

  const value = useMemo(() => {
    return {
      _id,
      compiler,
      name,
      rootDocId,
      members,
      invites,
      features,
      publicAccessLevel,
      owner,
      tags,
      trackChangesState,
      mainBibliographyDocId,
      projectSnapshot,
    }
  }, [
    _id,
    compiler,
    name,
    rootDocId,
    members,
    invites,
    features,
    publicAccessLevel,
    owner,
    tags,
    trackChangesState,
    mainBibliographyDocId,
    projectSnapshot,
  ])

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}
