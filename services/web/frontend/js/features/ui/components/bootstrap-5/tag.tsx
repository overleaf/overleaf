import { useTranslation } from 'react-i18next'
import { Badge } from 'react-bootstrap-5'
import MaterialIcon from '@/shared/components/material-icon'
import { MergeAndOverride } from '../../../../../../types/utils'
import classnames from 'classnames'

type TagProps = MergeAndOverride<
  React.ComponentProps<typeof Badge>,
  {
    prepend?: React.ReactNode
    closeBtnProps?: React.ComponentProps<'button'>
  }
>

function Tag({
  prepend,
  children,
  closeBtnProps,
  className,
  ...rest
}: TagProps) {
  const { t } = useTranslation()

  return (
    <Badge bg="light" className={classnames('badge-tag', className)} {...rest}>
      {prepend && <span className="badge-prepend">{prepend}</span>}
      <span className="badge-content">{children}</span>
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

export default Tag
