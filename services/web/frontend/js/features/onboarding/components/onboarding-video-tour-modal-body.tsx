/* eslint-disable jsx-a11y/media-has-caption */
import { useCallback, useRef } from 'react'
import { Modal } from 'react-bootstrap'
import { Trans } from 'react-i18next'
import type { OnboardingVideoStep } from '../utils/onboarding-video-step'

type OnboardingVideoTourModalBodyProps = {
  step: OnboardingVideoStep
}

export default function OnboardingVideoTourModalBody({
  step,
}: OnboardingVideoTourModalBodyProps) {
  const firstVideoRef = useRef<HTMLVideoElement>(null)
  const secondVideoRef = useRef<HTMLVideoElement>(null)

  const handleCanPlayFirstVideo = useCallback(() => {
    if (firstVideoRef.current) {
      firstVideoRef.current.playbackRate = 1.5
    }
  }, [firstVideoRef])

  const handleCanPlaySecondVideo = useCallback(() => {
    if (secondVideoRef.current) {
      secondVideoRef.current.playbackRate = 3.0
    }
  }, [secondVideoRef])

  return (
    <Modal.Body>
      <p>
        {step === 'first' ? (
          <Trans
            i18nKey="edit_in_the_left_pane_click_recompile"
            components={[<strong />]} // eslint-disable-line react/jsx-key
          />
        ) : (
          <Trans
            i18nKey="edit_in_source_to_see_your_entire_latex_code"
            components={[<strong />]} // eslint-disable-line react/jsx-key
          />
        )}
      </p>
      {step === 'first' ? (
        <video
          onCanPlay={handleCanPlayFirstVideo}
          ref={firstVideoRef}
          autoPlay
          loop
          width="100%"
          src="https://videos.ctfassets.net/nrgyaltdicpt/7MgWt7UdNv4yJcG2OrUene/387ab289e0e408511996f1152fc856d9/onboarding-tour-step-1.mp4"
        />
      ) : (
        <video
          onCanPlay={handleCanPlaySecondVideo}
          ref={secondVideoRef}
          autoPlay
          loop
          width="100%"
          src="https://videos.ctfassets.net/nrgyaltdicpt/2wYrdDqILSXaWP1LZScaDd/86a38effaeb400f42b480dba68a84b06/onboarding-tour-step-2.mp4"
        />
      )}
    </Modal.Body>
  )
}
