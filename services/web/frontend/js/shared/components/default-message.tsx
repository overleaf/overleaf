import { useTranslation } from 'react-i18next'

type DefaultMessageProps = {
  className?: string
  style?: React.CSSProperties
}

export function DefaultMessage({ className, style }: DefaultMessageProps) {
  const { t } = useTranslation()

  return (
    <>
      <span style={style}>{`${t('generic_something_went_wrong')}. `}</span>
      <span className={className}>{`${t('please_refresh')}`}</span>
    </>
  )
}
