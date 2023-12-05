import { FC } from 'react'
import { useTranslation } from 'react-i18next'

export const LoadingPane: FC = () => {
  const { t } = useTranslation()

  return (
    <div className="loading-panel">
      <span>
        <i className="fa fa-spin fa-refresh" />
        &nbsp;&nbsp;{t('loading')}…
      </span>
    </div>
  )
}
