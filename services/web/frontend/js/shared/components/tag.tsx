import { useTranslation } from 'react-i18next'
import { Label } from 'react-bootstrap'
import { MergeAndOverride } from '../../../../types/utils'
import classnames from 'classnames'

type TagProps = MergeAndOverride<
  React.ComponentProps<'span'>,
  {
    prepend?: React.ReactNode
    children: React.ReactNode
    closeBtnProps?: React.ComponentProps<'button'>
    className?: string
    bsStyle?: React.ComponentProps<typeof Label>['bsStyle'] | null
  }
>

function Tag({
  prepend,
  children,
  closeBtnProps,
  bsStyle,
  className,
  ...rest
}: TagProps) {
  const { t } = useTranslation()

  return (
    <span className={classnames('badge-tag-bs3', className)} {...rest}>
      {prepend && <span className="badge-tag-bs3-prepend">{prepend}</span>}
      <span className="badge-tag-bs3-content">{children}</span>
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
