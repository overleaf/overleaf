import { useCallback, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../../app/src/Features/Tags/types'
import Icon from '../../../../../shared/components/icon'
import { useProjectListContext } from '../../../context/project-list-context'
import { removeProjectFromTag } from '../../../util/api'
import classnames from 'classnames'
import { getTagColor } from '../../../util/tag'

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
  tag: Tag
  projectId: string
}

function InlineTag({ tag, projectId }: InlineTagProps) {
  const { t } = useTranslation()
  const { selectTag, removeProjectFromTagInView } = useProjectListContext()
  const [classNames, setClassNames] = useState('')
  const tagLabelRef = useRef(null)
  const tagBtnRef = useRef<HTMLButtonElement>(null)

  const handleLabelClick = (e: React.MouseEvent) => {
    // trigger the click on the button only when the event
    // is triggered from the wrapper element
    if (e.target === tagLabelRef.current) {
      tagBtnRef.current?.click()
    }
  }

  const handleRemoveTag = useCallback(
    async (tagId: string, projectId: string) => {
      removeProjectFromTagInView(tagId, projectId)
      await removeProjectFromTag(tagId, projectId)
    },
    [removeProjectFromTagInView]
  )
  const handleCloseMouseOver = () => setClassNames('tag-label-close-hover')
  const handleCloseMouseOut = () => setClassNames('')

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className={classnames('tag-label', classNames)}
      onClick={handleLabelClick}
      ref={tagLabelRef}
    >
      <button
        className="label label-default tag-label-name"
        aria-label={t('select_tag', { tagName: tag.name })}
        ref={tagBtnRef}
        onClick={() => selectTag(tag._id)}
      >
        <span
          style={{
            color: getTagColor(tag),
          }}
        >
          <Icon type="circle" aria-hidden="true" />
        </span>{' '}
        {tag.name}
      </button>
      {/* eslint-disable-next-line jsx-a11y/mouse-events-have-key-events */}
      <button
        className="label label-default tag-label-remove"
        aria-label={t('remove_tag', { tagName: tag.name })}
        onClick={() => handleRemoveTag(tag._id, projectId)}
        onMouseOver={handleCloseMouseOver}
        onMouseOut={handleCloseMouseOut}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

export default InlineTags
