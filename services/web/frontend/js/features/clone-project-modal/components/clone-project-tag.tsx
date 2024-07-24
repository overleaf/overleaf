import { FC } from 'react'
import { Tag as TagType } from '../../../../../app/src/Features/Tags/types'
import { getTagColor } from '@/features/project-list/util/tag'
import Icon from '@/shared/components/icon'
import { useTranslation } from 'react-i18next'
import Tag from '@/features/ui/components/bootstrap-5/tag'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

export const CloneProjectTag: FC<{
  tag: TagType
  removeTag: (tag: TagType) => void
}> = ({ tag, removeTag }) => {
  const { t } = useTranslation()

  return (
    <BootstrapVersionSwitcher
      bs3={
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
      }
      bs5={
        <Tag
          prepend={
            <i
              className="badge-tag-circle"
              style={{ backgroundColor: getTagColor(tag) }}
            />
          }
          closeBtnProps={{
            onClick: () => removeTag(tag),
          }}
          className="ms-2 mb-2"
        >
          {tag.name}
        </Tag>
      }
    />
  )
}
