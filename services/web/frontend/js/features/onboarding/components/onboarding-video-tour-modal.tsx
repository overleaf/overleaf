import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import AccessibleModal from '../../../shared/components/accessible-modal'
import customLocalStorage from '../../../infrastructure/local-storage'
import { sendMB } from '../../../infrastructure/event-tracking'
import OnboardingVideoTourModalBody from './onboarding-video-tour-modal-body'
import type { OnboardingVideoStep } from '../utils/onboarding-video-step'
import OnboardingVideoTourModalFooter from './onboarding-video-tour-modal-footer'
import { calculateWatchingTimeInSecond } from '../utils/watching-time'
import type { Nullable } from '../../../../../types/utils'

type OnboardingVideoTourModalProps = {
  show: boolean
  closeModal: () => void
}

function OnboardingVideoTourModal({
  show,
  closeModal,
}: OnboardingVideoTourModalProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<OnboardingVideoStep>('first')

  const startTimeWatchedFirstVideo = useRef(Date.now())
  const startTimeWatchedSecondVideo = useRef<Nullable<number>>(null)

  const handleClickCloseButton = useCallback(() => {
    customLocalStorage.setItem(
      'has_dismissed_onboarding_video_tour_modal',
      true
    )

    const { firstVideoWatchingTimeInSecond, secondVideoWatchingTimeInSecond } =
      calculateWatchingTimeInSecond(
        startTimeWatchedFirstVideo.current,
        startTimeWatchedSecondVideo.current
      )

    sendMB('onboarding-video-tour-close-button-click', {
      video: step,
      firstVideoWatchingTimeInSecond,
      secondVideoWatchingTimeInSecond,
    })
    closeModal()
  }, [closeModal, step])

  useEffect(() => {
    if (step === 'second') {
      startTimeWatchedSecondVideo.current = Date.now()
    }
  }, [step])

  return (
    <AccessibleModal
      onHide={handleClickCloseButton}
      show={show}
      backdrop="static"
    >
      <Modal.Header closeButton>
        <Modal.Title>{t('welcome_to_your_first_project')}</Modal.Title>
      </Modal.Header>
      <OnboardingVideoTourModalBody step={step} />
      <OnboardingVideoTourModalFooter
        step={step}
        setStep={setStep}
        closeModal={closeModal}
        startTimeWatchedFirstVideo={startTimeWatchedFirstVideo}
        startTimeWatchedSecondVideo={startTimeWatchedSecondVideo}
      />
    </AccessibleModal>
  )
}

export default memo(OnboardingVideoTourModal)
