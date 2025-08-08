import { useTranslation } from 'react-i18next'
import { Badge, BadgeProps } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import { MergeAndOverride } from '../../../../types/utils'
import classnames from 'classnames'
import { forwardRef } from 'react'

type TagProps = MergeAndOverride<
  BadgeProps,
  {
    prepend?: React.ReactNode
    contentProps?: React.ComponentProps<'button'>
    closeBtnProps?: React.ComponentProps<'button'>
  }
>

const Tag = forwardRef<HTMLElement, TagProps>(
  (
    { prepend, children, contentProps, closeBtnProps, className, ...rest },
    ref
  ) => {
    const { t } = useTranslation()

    const content = (
      <>
        {prepend && <span className="badge-prepend">{prepend}</span>}
        <span className="badge-content">{children}</span>
      </>
    )

    return (
      <Badge
        ref={ref}
        bg="light"
        className={classnames('badge-tag', className)}
        {...rest}
      >
        {contentProps?.onClick ? (
          <button
            type="button"
            {...contentProps}
            className={classnames(
              'badge-tag-content badge-tag-content-btn',
              contentProps.className
            )}
          >
            {content}
          </button>
        ) : (
          <span
            {...contentProps}
            className={classnames('badge-tag-content', contentProps?.className)}
          >
            {content}
          </span>
        )}
        {closeBtnProps && (
          <button
            type="button"
            className="badge-close"
            aria-label={t('remove_tag', { tagName: children })}
            {...closeBtnProps}
          >
            <MaterialIcon className="badge-close-icon" type="close" />
          </button>
        )}
      </Badge>
    )
  }
)

Tag.displayName = 'Tag'

export default Tag
