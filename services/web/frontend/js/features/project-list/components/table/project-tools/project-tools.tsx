import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectListContext } from '../../../context/project-list-context'
import ArchiveProjectsButton from './buttons/archive-projects-button'
import DownloadProjectsButton from './buttons/download-projects-button'
import ProjectToolsMoreDropdownButton from './buttons/project-tools-more-dropdown-button'
import TagsDropdown from './buttons/tags-dropdown'
import TrashProjectsButton from './buttons/trash-projects-button'
import UnarchiveProjectsButton from './buttons/unarchive-projects-button'
import UntrashProjectsButton from './buttons/untrash-projects-button'
import DeleteLeaveProjectsButton from './buttons/delete-leave-projects-button'
import LeaveProjectsButton from './buttons/leave-projects-button'
import DeleteProjectsButton from './buttons/delete-projects-button'
import OlButtonToolbar from '@/features/ui/components/ol/ol-button-toolbar'
import OlButtonGroup from '@/features/ui/components/ol/ol-button-group'

function ProjectTools() {
  const { t } = useTranslation()
  const { filter, selectedProjects } = useProjectListContext()

  return (
    <OlButtonToolbar aria-label={t('toolbar_selected_projects')}>
      <OlButtonGroup
        aria-label={t('toolbar_selected_projects_management_actions')}
      >
        <DownloadProjectsButton />
        {filter !== 'archived' && <ArchiveProjectsButton />}
        {filter !== 'trashed' && <TrashProjectsButton />}
      </OlButtonGroup>

      {(filter === 'trashed' || filter === 'archived') && (
        <OlButtonGroup aria-label={t('toolbar_selected_projects_restore')}>
          {filter === 'trashed' && <UntrashProjectsButton />}
          {filter === 'archived' && <UnarchiveProjectsButton />}
        </OlButtonGroup>
      )}

      {filter === 'trashed' && (
        <OlButtonGroup aria-label={t('toolbar_selected_projects_remove')}>
          <LeaveProjectsButton />
          <DeleteProjectsButton />
          <DeleteLeaveProjectsButton />
        </OlButtonGroup>
      )}

      {!['archived', 'trashed'].includes(filter) && <TagsDropdown />}

      {selectedProjects.length === 1 &&
        filter !== 'archived' &&
        filter !== 'trashed' && <ProjectToolsMoreDropdownButton />}
    </OlButtonToolbar>
  )
}

export default memo(ProjectTools)
