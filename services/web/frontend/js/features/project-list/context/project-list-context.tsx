import {
  cloneDeep,
  concat,
  filter as arrayFilter,
  find,
  flatten,
  uniq,
  uniqBy,
  without,
} from 'lodash'
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
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import getMeta from '../../../utils/meta'
import useAsync from '../../../shared/hooks/use-async'
import { getProjects } from '../util/api'
import sortProjects from '../util/sort-projects'

const MAX_PROJECT_PER_PAGE = 20

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

export const UNCATEGORIZED_KEY = 'uncategorized'

type ProjectListContextValue = {
  addClonedProjectToViewData: (project: Project) => void
  selectOrUnselectAllProjects: React.Dispatch<React.SetStateAction<boolean>>
  visibleProjects: Project[]
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
  selectedTagId?: string | undefined
  selectTag: (tagId: string) => void
  addTag: (tag: Tag) => void
  renameTag: (tagId: string, newTagName: string) => void
  deleteTag: (tagId: string) => void
  updateProjectViewData: (newProjectData: Project) => void
  removeProjectFromView: (project: Project) => void
  addProjectToTagInView: (tagId: string, projectId: string) => void
  removeProjectFromTagInView: (tagId: string, projectId: string) => void
  searchText: string
  setSearchText: React.Dispatch<React.SetStateAction<string>>
  selectedProjects: Project[]
  hiddenProjectsCount: number
  loadMoreCount: number
  showAllProjects: () => void
  loadMoreProjects: () => void
}

export const ProjectListContext = createContext<
  ProjectListContextValue | undefined
>(undefined)

type ProjectListProviderProps = {
  children: ReactNode
}

export function ProjectListProvider({ children }: ProjectListProviderProps) {
  const prefetchedProjectsBlob = getMeta('ol-prefetchedProjectsBlob')
  const [loadedProjects, setLoadedProjects] = useState<Project[]>(
    prefetchedProjectsBlob?.projects ?? []
  )
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([])
  const [maxVisibleProjects, setMaxVisibleProjects] =
    useState(MAX_PROJECT_PER_PAGE)
  const [hiddenProjectsCount, setHiddenProjectsCount] = useState(0)
  const [loadMoreCount, setLoadMoreCount] = useState<number>(0)
  const [loadProgress, setLoadProgress] = useState(
    prefetchedProjectsBlob ? 100 : 20
  )
  const [totalProjectsCount, setTotalProjectsCount] = useState<number>(
    prefetchedProjectsBlob?.totalSize ?? 0
  )
  const [sort, setSort] = useState<Sort>({
    by: 'lastUpdated',
    order: 'desc',
  })
  const [filter, setFilter] = usePersistedState<Filter>(
    'project-list-filter',
    'all'
  )
  const [selectedTagId, setSelectedTagId] = usePersistedState<
    string | undefined
  >('project-list-selected-tag-id', undefined)
  const [tags, setTags] = useState<Tag[]>(getMeta('ol-tags', []) as Tag[])
  const [searchText, setSearchText] = useState('')

  const {
    isLoading: loading,
    isIdle,
    error,
    runAsync,
  } = useAsync<GetProjectsResponseBody>({
    status: prefetchedProjectsBlob ? 'resolved' : 'pending',
    data: prefetchedProjectsBlob,
  })
  const isLoading = isIdle ? true : loading

  useEffect(() => {
    if (prefetchedProjectsBlob) return
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
  }, [prefetchedProjectsBlob, runAsync])

  // Search related effects
  useEffect(() => {
    if (!searchText.length) {
      return
    }

    const filteredProjects = loadedProjects.filter(project =>
      project.name.toLowerCase().includes(searchText.toLowerCase())
    )

    setVisibleProjects(filteredProjects)
  }, [searchText, loadedProjects])

  // Sort related effects
  useEffect(() => {
    setLoadedProjects(loadedProjects => sortProjects(loadedProjects, sort))
  }, [sort])

  // Filters/Tags and load more related effects
  useEffect(() => {
    let filteredProjects = [...loadedProjects]

    if (selectedTagId !== undefined) {
      if (selectedTagId === UNCATEGORIZED_KEY) {
        const taggedProjectIds = uniq(flatten(tags.map(tag => tag.project_ids)))
        filteredProjects = filteredProjects.filter(
          project =>
            !project.archived &&
            !project.trashed &&
            !taggedProjectIds.includes(project.id)
        )
      } else {
        const tag = tags.find(tag => tag._id === selectedTagId)
        if (tag) {
          filteredProjects = filteredProjects.filter(project =>
            tag?.project_ids?.includes(project.id)
          )
        } else {
          setFilter('all')
          setSelectedTagId(undefined)
        }
      }
    } else {
      filteredProjects = arrayFilter(filteredProjects, filters[filter])
    }

    // load more
    if (filteredProjects.length > maxVisibleProjects) {
      const visibleFilteredProjects = filteredProjects.slice(
        0,
        maxVisibleProjects
      )

      const hiddenFilteredProjectsCount =
        filteredProjects.slice(maxVisibleProjects).length

      setVisibleProjects(visibleFilteredProjects)
      setHiddenProjectsCount(hiddenFilteredProjectsCount)

      if (hiddenFilteredProjectsCount > MAX_PROJECT_PER_PAGE) {
        setLoadMoreCount(MAX_PROJECT_PER_PAGE)
      } else {
        setLoadMoreCount(hiddenFilteredProjectsCount)
      }
    } else {
      setVisibleProjects(filteredProjects)
      setLoadMoreCount(0)
      setHiddenProjectsCount(0)
    }
  }, [
    filter,
    loadedProjects,
    maxVisibleProjects,
    selectedTagId,
    setFilter,
    setSelectedTagId,
    tags,
  ])

  const showAllProjects = useCallback(() => {
    setLoadMoreCount(0)
    setHiddenProjectsCount(0)
    setMaxVisibleProjects(maxVisibleProjects + hiddenProjectsCount)
  }, [hiddenProjectsCount, maxVisibleProjects])

  const loadMoreProjects = useCallback(() => {
    setMaxVisibleProjects(maxVisibleProjects + loadMoreCount)
  }, [maxVisibleProjects, loadMoreCount])

  const selectedProjects = useMemo(() => {
    return visibleProjects.filter(project => project.selected)
  }, [visibleProjects])

  const selectOrUnselectAllProjects = useCallback(
    checked => {
      const visibleProjectIds = visibleProjects.map(p => p.id)
      setLoadedProjects(loadedProjects =>
        loadedProjects.map(p => {
          if (visibleProjectIds.includes(p.id)) {
            return { ...p, selected: checked }
          } else {
            return p
          }
        })
      )
    },
    [visibleProjects]
  )

  const untaggedProjectsCount = useMemo(() => {
    const taggedProjectIds = uniq(flatten(tags.map(tag => tag.project_ids)))
    return loadedProjects.filter(
      project =>
        !project.archived &&
        !project.trashed &&
        !taggedProjectIds.includes(project.id)
    ).length
  }, [tags, loadedProjects])

  const selectFilter = useCallback(
    (filter: Filter) => {
      setFilter(filter)
      setSelectedTagId(undefined)
      const selected = false
      selectOrUnselectAllProjects(selected)
    },
    [selectOrUnselectAllProjects, setFilter, setSelectedTagId]
  )

  const selectTag = useCallback(
    (tagId: string) => {
      setSelectedTagId(tagId)
    },
    [setSelectedTagId]
  )

  const addTag = useCallback((tag: Tag) => {
    setTags(tags => uniqBy(concat(tags, [tag]), '_id'))
  }, [])

  const renameTag = useCallback((tagId: string, newTagName: string) => {
    setTags(tags => {
      const newTags = cloneDeep(tags)
      const tag = find(newTags, ['_id', tagId])
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

  const addProjectToTagInView = useCallback(
    (tagId: string, projectId: string) => {
      setTags(tags => {
        const updatedTags = [...tags]
        for (const tag of updatedTags) {
          if (tag._id === tagId) {
            tag.project_ids = uniq([...(tag.project_ids || []), projectId])
          }
        }
        return updatedTags
      })
    },
    [setTags]
  )

  const removeProjectFromTagInView = useCallback(
    (tagId: string, projectId: string) => {
      setTags(tags => {
        const updatedTags = [...tags]
        for (const tag of updatedTags) {
          if (tag._id === tagId) {
            tag.project_ids = without(tag.project_ids || [], projectId)
          }
        }
        return updatedTags
      })
    },
    [setTags]
  )

  const addClonedProjectToViewData = useCallback(
    project => {
      // clone API not using camelCase and does not return all data

      const owner = {
        id: project.owner?._id,
        email: project.owner?.email,
        firstName: project.owner?.first_name,
        lastName: project.owner?.last_name,
      }

      const clonedProject = {
        ...project,
        id: project.project_id,
        owner,
        lastUpdatedBy: owner,
        source: 'owner',
        trashed: false,
        archived: false,
        accessLevel: 'owner',
      }

      setLoadedProjects(loadedProjects => {
        return sortProjects([...loadedProjects, clonedProject], sort)
      })
    },
    [sort]
  )

  const updateProjectViewData = useCallback((newProjectData: Project) => {
    setLoadedProjects(loadedProjects => {
      return loadedProjects.map((p: Project) =>
        p.id === newProjectData.id ? { ...newProjectData } : p
      )
    })
  }, [])

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
      addClonedProjectToViewData,
      addProjectToTagInView,
      deleteTag,
      error,
      filter,
      hiddenProjectsCount,
      isLoading,
      loadMoreCount,
      loadMoreProjects,
      loadProgress,
      removeProjectFromTagInView,
      removeProjectFromView,
      renameTag,
      selectedTagId,
      selectFilter,
      selectedProjects,
      selectOrUnselectAllProjects,
      selectTag,
      searchText,
      setSearchText,
      setSort,
      showAllProjects,
      sort,
      tags,
      totalProjectsCount,
      untaggedProjectsCount,
      updateProjectViewData,
      visibleProjects,
    }),
    [
      addTag,
      addClonedProjectToViewData,
      addProjectToTagInView,
      deleteTag,
      error,
      filter,
      hiddenProjectsCount,
      isLoading,
      loadMoreCount,
      loadMoreProjects,
      loadProgress,
      removeProjectFromTagInView,
      removeProjectFromView,
      renameTag,
      selectedTagId,
      selectFilter,
      selectedProjects,
      selectOrUnselectAllProjects,
      selectTag,
      searchText,
      setSearchText,
      setSort,
      showAllProjects,
      sort,
      tags,
      totalProjectsCount,
      untaggedProjectsCount,
      updateProjectViewData,
      visibleProjects,
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
