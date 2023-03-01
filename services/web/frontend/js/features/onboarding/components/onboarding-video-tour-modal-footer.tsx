import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
} from 'react'
import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import type { Nullable } from '../../../../../types/utils'
import { sendMB } from '../../../infrastructure/event-tracking'
import customLocalStorage from '../../../infrastructure/local-storage'
import type { OnboardingVideoStep } from '../utils/onboarding-video-step'
import { calculateWatchingTimeInSecond } from '../utils/watching-time'

type OnboardingVideoTourModalFooterProps = {
  step: OnboardingVideoStep
  setStep: Dispatch<SetStateAction<OnboardingVideoStep>>
  closeModal: () => void
  startTimeWatchedFirstVideo: RefObject<number>
  startTimeWatchedSecondVideo: RefObject<Nullable<number>>
}

export default function OnboardingVideoTourModalFooter({
  step,
  setStep,
  closeModal,
  startTimeWatchedFirstVideo,
  startTimeWatchedSecondVideo,
}: OnboardingVideoTourModalFooterProps) {
  const { t } = useTranslation()

  const handleClickDismiss = useCallback(() => {
    customLocalStorage.setItem(
      'has_dismissed_onboarding_video_tour_modal',
      true
    )

    const { firstVideoWatchingTimeInSecond, secondVideoWatchingTimeInSecond } =
      calculateWatchingTimeInSecond(
        startTimeWatchedFirstVideo.current ?? 0,
        startTimeWatchedSecondVideo.current
      )

    sendMB('onboarding-video-tour-dismiss-button-click', {
      firstVideoWatchingTimeInSecond,
      secondVideoWatchingTimeInSecond,
    })

    closeModal()
  }, [closeModal, startTimeWatchedFirstVideo, startTimeWatchedSecondVideo])

  const handleClickNext = useCallback(() => {
    const { firstVideoWatchingTimeInSecond, secondVideoWatchingTimeInSecond } =
      calculateWatchingTimeInSecond(
        startTimeWatchedFirstVideo.current ?? 0,
        startTimeWatchedSecondVideo.current
      )

    sendMB('onboarding-video-tour-next-button-click', {
      firstVideoWatchingTimeInSecond,
      secondVideoWatchingTimeInSecond,
    })

    setStep('second')
  }, [setStep, startTimeWatchedFirstVideo, startTimeWatchedSecondVideo])

  const handleClickDone = useCallback(() => {
    customLocalStorage.setItem(
      'has_dismissed_onboarding_video_tour_modal',
      true
    )

    const { firstVideoWatchingTimeInSecond, secondVideoWatchingTimeInSecond } =
      calculateWatchingTimeInSecond(
        startTimeWatchedFirstVideo.current ?? 0,
        startTimeWatchedSecondVideo.current
      )

    sendMB('onboarding-video-tour-done-button-click', {
      firstVideoWatchingTimeInSecond,
      secondVideoWatchingTimeInSecond,
    })

    closeModal()
  }, [closeModal, startTimeWatchedFirstVideo, startTimeWatchedSecondVideo])

  return (
    <Modal.Footer>
      {step === 'first' ? (
        <>
          <Button
            type="button"
            bsStyle={null}
            className="btn-secondary"
            onClick={handleClickDismiss}
          >
            {t('dismiss')}
          </Button>
          <Button type="submit" bsStyle="primary" onClick={handleClickNext}>
            {t('next')}
          </Button>
        </>
      ) : (
        <Button type="submit" bsStyle="primary" onClick={handleClickDone}>
          {t('done')}
        </Button>
      )}
    </Modal.Footer>
  )
}
