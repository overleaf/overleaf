import OLNotification from '@/features/ui/components/ol/ol-notification'
import PropTypes from 'prop-types'

export default function DangerMessage({ children }) {
  return <OLNotification type="error" content={children} />
}
DangerMessage.propTypes = {
  children: PropTypes.any.isRequired,
}
