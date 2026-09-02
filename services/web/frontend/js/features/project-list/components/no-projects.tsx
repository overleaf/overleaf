import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import { Filter } from '@/features/project-list/context/project-list-context'
import NewProjectButton from '@/features/project-list/components/new-project-button'
import getMeta from '@/utils/meta'

type NoProjectsCommonProps = {
  showNewProjectButton?: boolean
}

type NoProjectsProps = NoProjectsCommonProps & {
  activeSection: Filter
}

function NoProjects({ activeSection, showNewProjectButton }: NoProjectsProps) {
  const { t } = useTranslation()
  const usersBestSubscription = getMeta('ol-usersBestSubscription')
  const isGroupPlan = usersBestSubscription?.type === 'group'

  return (
    <div className="project-ds-empty-project-list">
      <div className="project-ds-empty-project-list-inner">
        <div className="project-ds-empty-project-list-icon">
          {activeSection === 'all' && (
            <MaterialIcon type="find_in_page" unfilled />
          )}
          {activeSection === 'owned' && <MaterialIcon type="person" unfilled />}
          {activeSection === 'shared' && <MaterialIcon type="group" unfilled />}
          {activeSection === 'archived' && (
            <MaterialIcon type="archive" unfilled />
          )}
          {activeSection === 'trashed' && (
            <MaterialIcon type="delete" unfilled />
          )}
        </div>
        <div className="d-flex flex-column gap-1">
          <div className="project-ds-empty-project-list-title">
            {(activeSection === 'all' || activeSection === 'owned') &&
              t('no_projects_yet')}
            {activeSection === 'shared' && t('nothing_shared_with_you_yet')}
            {activeSection === 'archived' && t('no_archived_projects')}
            {activeSection === 'trashed' && t('no_trashed_projects')}
          </div>
          <div className="project-ds-empty-project-list-description">
            {activeSection === 'all' &&
              t('projects_you_own_or_have_access_to_will_appear_here')}
            {activeSection === 'owned' &&
              (isGroupPlan
                ? t(
                    'projects_you_create_across_all_your_workspaces_will_appear_here'
                  )
                : t('projects_you_create_will_appear_here'))}
            {activeSection === 'shared' &&
              (isGroupPlan
                ? t(
                    'projects_shared_with_you_directly_or_in_shared_workspaces_will_appear_here'
                  )
                : t('projects_shared_with_you_directly_will_appear_here'))}
            {activeSection === 'archived' &&
              t('projects_you_archive_will_appear_here')}
            {activeSection === 'trashed' && (
              <>
                {t('projects_you_trash_will_appear_here')}
                <br />
                {t('you_can_restore_or_permanently_delete_them_at_any_time')}
              </>
            )}
          </div>
        </div>
        {showNewProjectButton && (
          <div className="text-center">
            <NewProjectButton
              id="new-project-button-no-projects"
              showAddAffiliationWidget
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default NoProjects
