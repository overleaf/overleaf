import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag as TagType } from '../../../../../../../app/src/Features/Tags/types'
import { useProjectListContext } from '../../../context/project-list-context'
import { removeProjectFromTag } from '../../../util/api'
import { getTagColor } from '../../../util/tag'
import Tag from '@/features/ui/components/bootstrap-5/tag'

type InlineTagsProps = {
  projectId: string
  className?: string
}

function InlineTags({ projectId, ...props }: InlineTagsProps) {
  const { tags } = useProjectListContext()

  return (
    <span {...props}>
      {tags
        .filter(tag => tag.project_ids?.includes(projectId))
        .map((tag, index) => (
          <InlineTag tag={tag} projectId={projectId} key={index} />
        ))}
    </span>
  )
}

type InlineTagProps = {
  tag: TagType
  projectId: string
}

function InlineTag({ tag, projectId }: InlineTagProps) {
  const { t } = useTranslation()
  const { selectTag, removeProjectFromTagInView } = useProjectListContext()

  const handleRemoveTag = useCallback(
    async (tagId: string, projectId: string) => {
      removeProjectFromTagInView(tagId, projectId)
      await removeProjectFromTag(tagId, projectId)
    },
    [removeProjectFromTagInView]
  )
  return (
    <Tag
      prepend={
        <i
          className="badge-tag-circle"
          style={{ backgroundColor: getTagColor(tag) }}
        />
      }
      contentProps={{
        'aria-label': t('select_tag', { tagName: tag.name }),
        onClick: () => selectTag(tag._id),
      }}
      closeBtnProps={{
        onClick: () => handleRemoveTag(tag._id, projectId),
      }}
      className="ms-2"
    >
      {tag.name}
    </Tag>
  )
}

export default InlineTags
