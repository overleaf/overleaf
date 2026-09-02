import { FC } from 'react'
import { Tag as TagType } from '../../../../../app/src/Features/Tags/types'
import { getTagColor } from '@/features/project-list/util/tag'
import OLTag from '@/shared/components/ol/ol-tag'
import classnames from 'classnames'

export const CloneProjectTag: FC<{
  tag: TagType
  removeTag: (tag: TagType) => void
  themed?: boolean
}> = ({ tag, removeTag, themed = false }) => {
  return (
    <OLTag
      prepend={
        <i
          className="badge-tag-circle"
          style={{ backgroundColor: getTagColor(tag) }}
        />
      }
      closeBtnProps={{
        onClick: () => removeTag(tag),
      }}
      className={classnames('ms-2 mb-2', { 'badge-themed': themed })}
    >
      {tag.name}
    </OLTag>
  )
}
