import { useTranslation } from 'react-i18next'

import Icon from './icon'

function IconChecked() {
  const { t } = useTranslation()
  return <Icon type="check" fw accessibilityLabel={t('selected')} />
}

export default IconChecked
