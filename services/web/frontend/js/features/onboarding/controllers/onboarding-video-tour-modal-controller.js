import { react2angular } from 'react2angular'
import { rootContext } from '../../../../../frontend/js/shared/context/root-context'
import App from '../../../../../frontend/js/base'
import getMeta from '../../../utils/meta'
import OnboardingVideoTourModal from '../components/onboarding-video-tour-modal'

export default App.controller(
  'OnboardingVideoTourModalController',
  function ($scope, localStorage) {
    const hasDismissedOnboardingVideoTourModal = localStorage(
      'has_dismissed_onboarding_video_tour_modal'
    )
    const showOnboardingVideoTour = getMeta('ol-showOnboardingVideoTour')

    $scope.show =
      !hasDismissedOnboardingVideoTourModal && showOnboardingVideoTour

    $scope.closeModal = () => {
      $scope.$applyAsync(() => {
        $scope.show = false
      })
    }
  }
)

App.component(
  'onboardingVideoTourModal',
  react2angular(rootContext.use(OnboardingVideoTourModal), [
    'show',
    'closeModal',
  ])
)
