import { useTranslation } from 'react-i18next'

export default function NoOpenDocPane() {
  const { t } = useTranslation()

  return (
    <div className="loading-panel">
      <span>
        <i className="fa fa-arrow-left" />
        &nbsp;&nbsp;{t('open_a_file_on_the_left')}
      </span>
    </div>
  )
}
