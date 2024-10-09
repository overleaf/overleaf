import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useProjectContext } from '../../../shared/context/project-context'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'

export default function SendInvitesNotice() {
  const { publicAccessLevel } = useProjectContext()

  return (
    <OLRow className="public-access-level public-access-level-notice">
      <OLCol className="text-center">
        <AccessLevel level={publicAccessLevel} />
      </OLCol>
    </OLRow>
  )
}

function AccessLevel({ level }) {
  const { t } = useTranslation()
  switch (level) {
    case 'private':
      return t('to_add_more_collaborators')

    case 'tokenBased':
      return t('to_change_access_permissions')

    default:
      return null
  }
}
AccessLevel.propTypes = {
  level: PropTypes.string,
}
