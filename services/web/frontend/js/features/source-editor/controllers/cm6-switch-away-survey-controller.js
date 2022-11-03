import App from '../../../base'
import { react2angular } from 'react2angular'
import { rootContext } from '../../../shared/context/root-context'
import CM6SwitchAwaySurvey from '../components/cm6-switch-away-survey'

App.component(
  'cm6SwitchAwaySurvey',
  react2angular(rootContext.use(CM6SwitchAwaySurvey))
)
