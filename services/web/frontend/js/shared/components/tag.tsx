import { useTranslation } from 'react-i18next'
import { Label } from 'react-bootstrap'
import { MergeAndOverride } from '../../../../types/utils'
import classnames from 'classnames'

type TagProps = MergeAndOverride<
  React.ComponentProps<'span'>,
  {
    prepend?: React.ReactNode
    children: React.ReactNode
    contentProps?: React.ComponentProps<'button'>
    closeBtnProps?: React.ComponentProps<'button'>
    className?: string
    bsStyle?: React.ComponentProps<typeof Label>['bsStyle'] | null
  }
>

function Tag({
  prepend,
  children,
  contentProps,
  closeBtnProps,
  bsStyle,
  className,
  ...rest
}: TagProps) {
  const { t } = useTranslation()

  return (
    <span className={classnames('badge-tag-bs3', className)} {...rest}>
      <span
        {...contentProps}
        className={classnames(
          'badge-tag-bs3-content-wrapper',
          { clickable: Boolean(contentProps?.onClick) },
          contentProps?.className
        )}
      >
        {prepend && <span className="badge-tag-bs3-prepend">{prepend}</span>}
        <span className="badge-tag-bs3-content">{children}</span>
      </span>
      {closeBtnProps && (
        <button
          type="button"
          className="badge-tag-bs3-close"
          aria-label={t('remove_tag', { tagName: children })}
          {...closeBtnProps}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      )}
    </span>
  )
}

export default Tag
