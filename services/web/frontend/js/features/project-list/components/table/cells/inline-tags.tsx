import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../../app/src/Features/Tags/types'
import ColorManager from '../../../../../ide/colors/ColorManager'
import Icon from '../../../../../shared/components/icon'
import { useProjectListContext } from '../../../context/project-list-context'

type InlineTagsProps = {
  projectId: string
}

function InlineTags({ projectId }: InlineTagsProps) {
  const { tags } = useProjectListContext()

  return (
    <span>
      {tags
        .filter(tag => tag.project_ids?.includes(projectId))
        .map((tag, index) => (
          <InlineTag tag={tag} key={index} />
        ))}
    </span>
  )
}

function InlineTag({ tag }: { tag: Tag }) {
  const { t } = useTranslation()

  return (
    <div className="tag-label">
      <button
        className="label label-default tag-label-name"
        aria-label={t('select_tag', { tagName: tag.name })}
      >
        <span
          style={{
            color: `hsl(${ColorManager.getHueForTagId(tag._id)}, 70%, 45%)`,
          }}
        >
          <Icon type="circle" aria-hidden="true" />
        </span>{' '}
        {tag.name}
      </button>
      <button
        className="label label-default tag-label-remove"
        aria-label={t('remove_tag', { tagName: tag.name })}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

export default InlineTags
