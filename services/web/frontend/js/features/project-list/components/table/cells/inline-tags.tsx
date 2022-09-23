import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag } from '../../../../../../../app/src/Features/Tags/types'
import ColorManager from '../../../../../ide/colors/ColorManager'
import Icon from '../../../../../shared/components/icon'
import { useProjectListContext } from '../../../context/project-list-context'
import classnames from 'classnames'

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
          <InlineTag tag={tag} key={index} />
        ))}
    </span>
  )
}

function InlineTag({ tag }: { tag: Tag }) {
  const { t } = useTranslation()
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
      {/* eslint-disable-next-line jsx-a11y/mouse-events-have-key-events */}
      <button
        className="label label-default tag-label-remove"
        aria-label={t('remove_tag', { tagName: tag.name })}
        onMouseOver={handleCloseMouseOver}
        onMouseOut={handleCloseMouseOut}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )
}

export default InlineTags
