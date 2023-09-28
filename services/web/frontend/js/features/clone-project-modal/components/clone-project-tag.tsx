import { FC } from 'react'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import { getTagColor } from '@/features/project-list/util/tag'
import Icon from '@/shared/components/icon'
import { useTranslation } from 'react-i18next'

export const CloneProjectTag: FC<{
  tag: Tag
  removeTag: (tag: Tag) => void
}> = ({ tag, removeTag }) => {
  const { t } = useTranslation()

  return (
    <div className="tag-label" role="option" aria-selected>
      <span className="label label-default tag-label-name">
        <span style={{ color: getTagColor(tag) }}>
          <Icon type="circle" aria-hidden />
        </span>{' '}
        {tag.name}
      </span>
      <button
        type="button"
        className="label label-default tag-label-remove"
        onClick={() => removeTag(tag)}
        aria-label={t('remove_tag', { tagName: tag.name })}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}
