import _ from 'lodash'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import {
  GetProjectsResponseBody,
  Project,
  Sort,
} from '../../../../../types/project/dashboard/api'
import getMeta from '../../../utils/meta'
import useAsync from '../../../shared/hooks/use-async'
import { getProjects } from '../util/api'

export type Filter = 'all' | 'owned' | 'shared' | 'archived' | 'trashed'
type FilterMap = {
  [key in Filter]: Partial<Project> | ((project: Project) => boolean) // eslint-disable-line no-unused-vars
}
const filters: FilterMap = {
  all: {
    archived: false,
    trashed: false,
  },
  owned: {
    accessLevel: 'owner',
    archived: false,
    trashed: false,
  },
  shared: project => {
    return (
      project.accessLevel !== 'owner' && !project.archived && !project.trashed
    )
  },
  archived: {
    archived: true,
    trashed: false,
  },
  trashed: {
    trashed: true,
  },
}

type ProjectListContextValue = {
  visibleProjects: Project[]
  setVisibleProjects: React.Dispatch<React.SetStateAction<Project[]>>
  totalProjectsCount: number
  error: Error | null
  isLoading: ReturnType<typeof useAsync>['isLoading']
  loadProgress: number
  sort: Sort
  setSort: React.Dispatch<React.SetStateAction<Sort>>
  tags: Tag[]
  untaggedProjectsCount: number
  filter: Filter
  selectFilter: (filter: Filter) => void
  selectedTag?: string | null
  selectTag: (tagName: string | null) => void
  addTag: (tag: Tag) => void
  renameTag: (tagId: string, newTagName: string) => void
  deleteTag: (tagId: string) => void
  updateProjectViewData: (project: Project) => void
  removeProjectFromView: (project: Project) => void
  setSearchText: React.Dispatch<React.SetStateAction<string>>
}

export const ProjectListContext = createContext<
  ProjectListContextValue | undefined
>(undefined)

type ProjectListProviderProps = {
  children: ReactNode
}

export function ProjectListProvider({ children }: ProjectListProviderProps) {
  const [loadedProjects, setLoadedProjects] = useState<Project[]>([])
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([])
  const [loadProgress, setLoadProgress] = useState(20)
  const [totalProjectsCount, setTotalProjectsCount] = useState<number>(0)
  const [sort, setSort] = useState<Sort>({
    by: 'lastUpdated',
    order: 'desc',
  })
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedTag, setSelectedTag] = useState<string | null>()
  const [tags, setTags] = useState<Tag[]>([])
  const [searchText, setSearchText] = useState('')
  const {
    isLoading: loading,
    isIdle,
    error,
    runAsync,
  } = useAsync<GetProjectsResponseBody>()
  const isLoading = isIdle ? true : loading

  useEffect(() => setTags(getMeta('ol-tags', []) as Tag[]), [])

  useEffect(() => {
    setLoadProgress(40)
    runAsync(getProjects({ by: 'lastUpdated', order: 'desc' }))
      .then(data => {
        setLoadedProjects(data.projects)
        setTotalProjectsCount(data.totalSize)
      })
      .catch(error => console.error(error))
      .finally(() => {
        setLoadProgress(100)
      })
  }, [runAsync])

  useEffect(() => {
    let filteredProjects = [...loadedProjects]

    if (searchText.length) {
      filteredProjects = filteredProjects.filter(project =>
        project.name.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    if (selectedTag !== undefined) {
      if (selectedTag === null) {
        const taggedProjectIds = _.uniq(
          _.flatten(tags.map(tag => tag.project_ids))
        )
        filteredProjects = filteredProjects.filter(
          project =>
            !project.archived &&
            !project.trashed &&
            !taggedProjectIds.includes(project.id)
        )
      } else {
        const tag = _.find(tags, tag => tag._id === selectedTag)
        filteredProjects = filteredProjects.filter(project =>
          tag?.project_ids?.includes(project.id)
        )
      }
    } else {
      filteredProjects = _.filter(filteredProjects, filters[filter])
    }

    setVisibleProjects(filteredProjects)
  }, [loadedProjects, tags, filter, selectedTag, searchText])

  const untaggedProjectsCount = useMemo(() => {
    const taggedProjectIds = _.uniq(_.flatten(tags.map(tag => tag.project_ids)))
    return loadedProjects.filter(
      project =>
        !project.archived &&
        !project.trashed &&
        !taggedProjectIds.includes(project.id)
    ).length
  }, [tags, loadedProjects])

  const selectFilter = useCallback((filter: Filter) => {
    setFilter(filter)
    setSelectedTag(undefined)
  }, [])

  const selectTag = useCallback((tagId: string | null) => {
    setSelectedTag(tagId)
  }, [])

  const addTag = useCallback((tag: Tag) => {
    setTags(tags => _.uniqBy(_.concat(tags, [tag]), '_id'))
  }, [])

  const renameTag = useCallback((tagId: string, newTagName: string) => {
    setTags(tags => {
      const newTags = _.cloneDeep(tags)
      const tag = _.find(newTags, ['_id', tagId])
      if (tag) {
        tag.name = newTagName
      }
      return newTags
    })
  }, [])

  const deleteTag = useCallback(
    (tagId: string | null) => {
      setTags(tags => tags.filter(tag => tag._id !== tagId))
    },
    [setTags]
  )

  const updateProjectViewData = useCallback(
    (project: Project) => {
      const projects = loadedProjects.map((p: Project) => {
        if (p.id === project.id) {
          p = project
        }
        return p
      })
      setLoadedProjects(projects)
    },
    [loadedProjects]
  )

  const removeProjectFromView = useCallback(
    (project: Project) => {
      const projects = loadedProjects.filter(
        (p: Project) => p.id !== project.id
      )
      setLoadedProjects(projects)
    },
    [loadedProjects]
  )

  const value = useMemo<ProjectListContextValue>(
    () => ({
      addTag,
      deleteTag,
      error,
      filter,
      isLoading,
      loadProgress,
      renameTag,
      selectedTag,
      selectFilter,
      selectTag,
      setSearchText,
      setSort,
      setVisibleProjects,
      sort,
      tags,
      totalProjectsCount,
      untaggedProjectsCount,
      updateProjectViewData,
      visibleProjects,
      removeProjectFromView,
    }),
    [
      addTag,
      deleteTag,
      error,
      filter,
      isLoading,
      loadProgress,
      renameTag,
      selectedTag,
      selectFilter,
      selectTag,
      setSearchText,
      setSort,
      setVisibleProjects,
      sort,
      tags,
      totalProjectsCount,
      untaggedProjectsCount,
      updateProjectViewData,
      visibleProjects,
      removeProjectFromView,
    ]
  )

  return (
    <ProjectListContext.Provider value={value}>
      {children}
    </ProjectListContext.Provider>
  )
}

export function useProjectListContext() {
  const context = useContext(ProjectListContext)
  if (!context) {
    throw new Error(
      'ProjectListContext is only available inside ProjectListProvider'
    )
  }
  return context
}
