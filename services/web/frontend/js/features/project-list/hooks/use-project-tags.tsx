import { useProjectListContext } from '@/features/project-list/context/project-list-context'
import { useMemo } from 'react'

export const useProjectTags = (projectId: string) => {
  const { tags } = useProjectListContext()

  return useMemo(
    () => tags.filter(tag => tag.project_ids?.includes(projectId)),
    [tags, projectId]
  )
}
