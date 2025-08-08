import { FC } from 'react'
import { Tag as TagType } from '../../../../../app/src/Features/Tags/types'
import { getTagColor } from '@/features/project-list/util/tag'
import Tag from '@/shared/components/tag'

export const CloneProjectTag: FC<{
  tag: TagType
  removeTag: (tag: TagType) => void
}> = ({ tag, removeTag }) => {
  return (
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
  )
}
