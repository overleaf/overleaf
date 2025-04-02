import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

export default function MemberPrivileges({ privileges }) {
  const { t } = useTranslation()

  switch (privileges) {
    case 'readAndWrite':
      return t('editor')

    case 'readOnly':
      return t('viewer')

    case 'review':
      return t('reviewer')

    default:
      return null
  }
}
MemberPrivileges.propTypes = {
  privileges: PropTypes.string.isRequired,
}
