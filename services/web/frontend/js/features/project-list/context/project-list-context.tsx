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
  useRef,
  useState,
} from 'react'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import {
  ClonedProject,
  GetProjectsResponseBody,
  Project,
  Sort,
} from '../../../../../types/project/dashboard/api'
import getMeta from '../../../utils/meta'
import useAsync from '../../../shared/hooks/use-async'
import { getProjects } from '../util/api'
import sortProjects from '../util/sort-projects'
import {
  getInitialNavigationState,
  getNavigationState,
  getNavigationUrl,
  migrateLegacyNavigationState,
  NavigationState,
} from '../util/navigation-state'
import {
  isArchivedOrTrashed,
  isDeletableProject,
  isLeavableProject,
} from '../util/project'
import { debugConsole } from '@/utils/debugging'
import { useLocation } from '@/shared/hooks/use-location'

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

export type ProjectListContextValue = {
  addClonedProjectToViewData: (project: ClonedProject) => void
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
  projectsPerTag: Record<Tag['_id'], Project[]>
  currentFilterProjectsCount: number
  filter: Filter
  selectFilter: (filter: Filter) => void
  selectedTagId?: string | undefined
  selectTag: (tagId: string) => void
  addTag: (tag: Tag) => void
  updateTag: (tagId: string, newTagName: string, newTagColor?: string) => void
  deleteTag: (tagId: string) => void
  updateProjectViewData: (newProjectData: Project) => void
  removeProjectFromView: (project: Project) => void
  addProjectToTagInView: (tagId: string, projectId: string) => void
  removeProjectFromTagInView: (tagId: string, projectId: string) => void
  searchText: string
  setSearchText: React.Dispatch<React.SetStateAction<string>>
  selectedProjects: Project[]
  selectedProjectIds: Set<string>
  setSelectedProjectIds: React.Dispatch<React.SetStateAction<Set<string>>>
  toggleSelectedProject: (projectId: string, selected?: boolean) => void
  hiddenProjectsCount: number
  loadMoreCount: number
  showAllProjects: () => void
  loadMoreProjects: () => void
  hasLeavableProjectsSelected: boolean
  hasDeletableProjectsSelected: boolean
}

export const ProjectListContext = createContext<
  ProjectListContextValue | undefined
>(undefined)

export type NavigationMode = 'filter-projects' | 'redirect-to-filtered-projects'

type ProjectListProviderProps = {
  children: ReactNode
  navigationMode?: NavigationMode
}

export function ProjectListProvider({
  children,
  navigationMode = 'filter-projects',
}: ProjectListProviderProps) {
  const location = useLocation()
  const prefetchedProjectsBlob = getMeta('ol-prefetchedProjectsBlob')
  const [loadedProjects, setLoadedProjects] = useState<Project[]>(
    prefetchedProjectsBlob?.projects ?? []
  )
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([])
  const [maxVisibleProjects, setMaxVisibleProjects] =
    useState(MAX_PROJECT_PER_PAGE)
  const [hiddenProjectsCount, setHiddenProjectsCount] = useState(0)
  const [loadMoreCount, setLoadMoreCount] = useState(0)
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
  const [initialNavigationState] = useState<NavigationState>(() => {
    if (navigationMode !== 'filter-projects') {
      return { type: 'filter', filter: 'all' }
    }
    return getInitialNavigationState()
  })
  const [filter, setFilter] = useState<Filter>(
    initialNavigationState.type === 'filter'
      ? initialNavigationState.filter
      : 'all'
  )
  const prevSortRef = useRef<Sort>(sort)
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>(
    initialNavigationState.type === 'tag'
      ? initialNavigationState.tag
      : undefined
  )
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const olTags = getMeta('ol-tags') || []

  const [tags, setTags] = useState<Tag[]>(() =>
    // `tag.name` data may be null for some old users
    olTags.map(tag => ({ ...tag, name: tag.name ?? '' }))
  )

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
      .catch(debugConsole.error)
      .finally(() => {
        setLoadProgress(100)
      })
  }, [prefetchedProjectsBlob, runAsync])

  useEffect(() => {
    let filteredProjects = [...loadedProjects]

    if (searchText.length) {
      filteredProjects = filteredProjects.filter(project =>
        project.name.toLowerCase().includes(searchText.toLowerCase())
      )
    }

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
          filteredProjects = filteredProjects.filter(
            p => !isArchivedOrTrashed(p) && tag?.project_ids?.includes(p.id)
          )
        } else {
          setSelectedTagId(undefined)
        }
      }
    } else {
      filteredProjects = arrayFilter(filteredProjects, filters[filter])
    }

    if (prevSortRef.current !== sort) {
      filteredProjects = sortProjects(filteredProjects, sort)
      const loadedProjectsSorted = sortProjects(loadedProjects, sort)
      setLoadedProjects(loadedProjectsSorted)
    }

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
    loadedProjects,
    maxVisibleProjects,
    tags,
    filter,
    setFilter,
    selectedTagId,
    setSelectedTagId,
    searchText,
    sort,
  ])

  useEffect(() => {
    prevSortRef.current = sort
  }, [sort])

  useEffect(() => {
    if (navigationMode !== 'filter-projects') return
    const handlePopState = () => {
      const navigationState = getNavigationState(window.location.pathname)
      if (navigationState.type === 'tag') {
        setFilter('all')
        setSelectedTagId(navigationState.tag)
      } else {
        setFilter(navigationState.filter)
        setSelectedTagId(undefined)
      }
      setSelectedProjectIds(new Set<string>())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [navigationMode])

  // Temporary: migrate the legacy local-storage navigation state to the URL on
  // first load. Safe to remove around September 2026 (see navigation-state.ts).
  // Only in 'filter-projects' mode: migrateLegacyNavigationState() clears the
  // stored state unconditionally, so running it on the library page would wipe
  // the dashboard's remembered filter before the migration could apply it.
  useEffect(() => {
    if (navigationMode !== 'filter-projects') return
    migrateLegacyNavigationState()
  }, [navigationMode])

  const showAllProjects = useCallback(() => {
    setLoadMoreCount(0)
    setHiddenProjectsCount(0)
    setMaxVisibleProjects(maxVisibleProjects + hiddenProjectsCount)
  }, [hiddenProjectsCount, maxVisibleProjects])

  const loadMoreProjects = useCallback(() => {
    setMaxVisibleProjects(maxVisibleProjects + loadMoreCount)
  }, [maxVisibleProjects, loadMoreCount])

  const [selectedProjectIds, setSelectedProjectIds] = useState(
    () => new Set<string>()
  )

  const toggleSelectedProject = useCallback(
    (projectId: string, selected?: boolean) => {
      setSelectedProjectIds(prevSelectedProjectIds => {
        const selectedProjectIds = new Set(prevSelectedProjectIds)
        if (selected === true) {
          selectedProjectIds.add(projectId)
        } else if (selected === false) {
          selectedProjectIds.delete(projectId)
        } else if (selectedProjectIds.has(projectId)) {
          selectedProjectIds.delete(projectId)
        } else {
          selectedProjectIds.add(projectId)
        }
        return selectedProjectIds
      })
    },
    []
  )

  const selectedProjects = useMemo(() => {
    return visibleProjects.filter(project => selectedProjectIds.has(project.id))
  }, [selectedProjectIds, visibleProjects])

  const selectOrUnselectAllProjects = useCallback(
    (checked: any) => {
      setSelectedProjectIds(prevSelectedProjectIds => {
        const selectedProjectIds = new Set(prevSelectedProjectIds)
        for (const project of visibleProjects) {
          if (checked) {
            selectedProjectIds.add(project.id)
          } else {
            selectedProjectIds.delete(project.id)
          }
        }
        return selectedProjectIds
      })
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

  const projectsPerTag = useMemo(() => {
    return tags.reduce<Record<Tag['_id'], Project[]>>((prev, curTag) => {
      const tagProjects = loadedProjects.filter(p => {
        return !isArchivedOrTrashed(p) && curTag.project_ids?.includes(p.id)
      })
      return { ...prev, [curTag._id]: tagProjects }
    }, {})
  }, [tags, loadedProjects])

  // How many projects the current filter matches, ignoring the search text.
  // `visibleProjects` can't answer "is this view empty?" on its own, because it
  // is also narrowed by the search text (which persists across filter changes)
  // and by pagination. Callers need the distinction to tell an empty view apart
  // from a search that matched nothing.
  const currentFilterProjectsCount = useMemo(
    () => arrayFilter(loadedProjects, filters[filter]).length,
    [loadedProjects, filter]
  )

  const selectFilter = useCallback(
    (filter: Filter) => {
      const url = getNavigationUrl({ type: 'filter', filter })
      if (navigationMode === 'redirect-to-filtered-projects') {
        location.assign(url)
        return
      }
      setFilter(filter)
      setSelectedTagId(undefined)
      const selected = false
      selectOrUnselectAllProjects(selected)
      window.history.pushState(null, '', url)
    },
    [
      navigationMode,
      location,
      selectOrUnselectAllProjects,
      setFilter,
      setSelectedTagId,
    ]
  )

  const selectTag = useCallback(
    (tagId: string) => {
      const url = getNavigationUrl({ type: 'tag', tag: tagId })
      if (navigationMode === 'redirect-to-filtered-projects') {
        location.assign(url)
        return
      }
      setFilter('all')
      setSelectedTagId(tagId)
      window.history.pushState(null, '', url)
    },
    [navigationMode, location, setSelectedTagId, setFilter]
  )

  const addTag = useCallback((tag: Tag) => {
    setTags(tags => uniqBy(concat(tags, [tag]), '_id'))
  }, [])

  const updateTag = useCallback(
    (tagId: string, newTagName: string, newTagColor?: string) => {
      setTags(tags => {
        const newTags = cloneDeep(tags)
        const tag = find(newTags, ['_id', tagId])
        if (tag) {
          tag.name = newTagName
          tag.color = newTagColor
        }
        return newTags
      })
    },
    []
  )

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
    (project: ClonedProject) => {
      // clone API not using camelCase and does not return all data

      const owner = {
        id: project.owner?._id,
        email: project.owner?.email,
        firstName: project.owner?.first_name,
        lastName: project.owner?.last_name,
      }

      const clonedProject: Project = {
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
      return loadedProjects.map(p =>
        p.id === newProjectData.id ? { ...newProjectData } : p
      )
    })
  }, [])

  const removeProjectFromView = useCallback((project: Project) => {
    setLoadedProjects(loadedProjects => {
      return loadedProjects.filter(p => p.id !== project.id)
    })
  }, [])

  const hasLeavableProjectsSelected = useMemo(
    () => selectedProjects.some(isLeavableProject),
    [selectedProjects]
  )

  const hasDeletableProjectsSelected = useMemo(
    () => selectedProjects.some(isDeletableProject),
    [selectedProjects]
  )

  const value = useMemo<ProjectListContextValue>(
    () => ({
      addTag,
      addClonedProjectToViewData,
      addProjectToTagInView,
      deleteTag,
      error,
      filter,
      hasLeavableProjectsSelected,
      hasDeletableProjectsSelected,
      hiddenProjectsCount,
      isLoading,
      loadMoreCount,
      loadMoreProjects,
      loadProgress,
      removeProjectFromTagInView,
      removeProjectFromView,
      selectedTagId,
      selectFilter,
      selectedProjects,
      selectedProjectIds,
      selectOrUnselectAllProjects,
      selectTag,
      searchText,
      setSearchText,
      setSelectedProjectIds,
      setShowCustomPicker,
      setSort,
      showAllProjects,
      showCustomPicker,
      sort,
      tags,
      toggleSelectedProject,
      totalProjectsCount,
      untaggedProjectsCount,
      updateProjectViewData,
      updateTag,
      projectsPerTag,
      currentFilterProjectsCount,
      visibleProjects,
    }),
    [
      addTag,
      addClonedProjectToViewData,
      addProjectToTagInView,
      deleteTag,
      error,
      filter,
      hasLeavableProjectsSelected,
      hasDeletableProjectsSelected,
      hiddenProjectsCount,
      isLoading,
      loadMoreCount,
      loadMoreProjects,
      loadProgress,
      removeProjectFromTagInView,
      removeProjectFromView,
      selectedTagId,
      selectFilter,
      selectedProjectIds,
      selectedProjects,
      selectOrUnselectAllProjects,
      selectTag,
      searchText,
      setSearchText,
      setSelectedProjectIds,
      setShowCustomPicker,
      setSort,
      showAllProjects,
      showCustomPicker,
      sort,
      tags,
      toggleSelectedProject,
      totalProjectsCount,
      untaggedProjectsCount,
      updateProjectViewData,
      updateTag,
      projectsPerTag,
      currentFilterProjectsCount,
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
