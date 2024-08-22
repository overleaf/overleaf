import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import { Tag } from '../../../../../../app/src/Features/Tags/types'
import { Filter, UNCATEGORIZED_KEY } from '../../context/project-list-context'

function ProjectListTitle({
  filter,
  selectedTag,
  selectedTagId,
  className,
}: {
  filter: Filter
  selectedTag: Tag | undefined
  selectedTagId: string | undefined
  className?: string
}) {
  const { t } = useTranslation()
  let message = t('projects')

  if (selectedTag) {
    message = `${selectedTag.name}`
  } else if (selectedTagId === UNCATEGORIZED_KEY) {
    message = t('uncategorized_projects')
  } else {
    switch (filter) {
      case 'all':
        message = t('all_projects')
        break
      case 'owned':
        message = t('your_projects')
        break
      case 'shared':
        message = t('shared_with_you')
        break
      case 'archived':
        message = t('archived_projects')
        break
      case 'trashed':
        message = t('trashed_projects')
        break
    }
  }

  return (
    <div className={classnames('project-list-title', className)}>{message}</div>
  )
}

export default ProjectListTitle
