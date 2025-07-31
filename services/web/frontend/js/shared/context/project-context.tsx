import {
  FC,
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from 'react'
import getMeta from '@/utils/meta'
import { ProjectUpdate, ProjectMetadata } from './types/project-metadata'
import { ProjectSnapshot } from '@/infrastructure/project-snapshot'
import { Tag } from '../../../../app/src/Features/Tags/types'

type ProjectContextValue = {
  projectId: ProjectMetadata['_id']
  project: ProjectMetadata | null
  joinProject: (project: ProjectMetadata) => void
  updateProject: (projectUpdate: ProjectUpdate) => void
  joinedOnce: boolean
  projectSnapshot: ProjectSnapshot
  tags: Tag[]
  features: ProjectMetadata['features']
  name: ProjectMetadata['name']
}

export const ProjectContext = createContext<ProjectContextValue | undefined>(
  undefined
)

export function useProjectContext() {
  const context = useContext(ProjectContext)

  if (!context) {
    throw new Error(
      'useProjectContext is only available inside ProjectProvider'
    )
  }

  return context
}

export const ProjectProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const [joinedOnce, setJoinedOnce] = useState(false)
  const [project, setProject] = useState<ProjectMetadata | null>(null)

  // Expose some project properties with fallbacks for convenience
  const projectId = project ? project._id : getMeta('ol-project_id')
  const name = project ? project.name : ''
  const features = project ? project.features : {}

  const joinProject = useCallback((projectData: ProjectMetadata) => {
    setProject(projectData)
    setJoinedOnce(true)
  }, [])

  const updateProject = useCallback((projectUpdateData: ProjectUpdate) => {
    setProject(projectData => {
      // Only perform the update if `project` is already set, otherwise we could
      // end up with an incomplete project object
      if (!projectData) {
        throw new Error('Project not initialized. Use joinProject first.')
      }

      return Object.assign({}, projectData, projectUpdateData)
    })
  }, [])

  const [projectSnapshot] = useState(() => new ProjectSnapshot(projectId))

  const tags = useMemo(
    () =>
      (getMeta('ol-projectTags') || [])
        // `tag.name` data may be null for some old users
        .map((tag: any) => ({ ...tag, name: tag.name ?? '' })),
    []
  )

  const value = {
    projectId,
    project,
    joinProject,
    updateProject,
    joinedOnce,
    projectSnapshot,
    tags,
    features,
    name,
  }

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  )
}
