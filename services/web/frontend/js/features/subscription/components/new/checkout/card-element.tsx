import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FormGroup, ControlLabel } from 'react-bootstrap'
import { CardElementChangeState } from '../../../../../../../types/recurly/elements'
import { ElementsInstance } from 'recurly__recurly-js'
import classnames from 'classnames'
import getMeta from '../../../../../utils/meta'

type CardElementProps = {
  className?: string
  elements: ElementsInstance
  onChange: (state: CardElementChangeState) => void
}

function CardElement({ className, elements, onChange }: CardElementProps) {
  const { t } = useTranslation()
  const [showCardElementInvalid, setShowCardElementInvalid] =
    useState<boolean>()
  const cardRef = useRef<HTMLDivElement | null>(null)

  // Card initialization
  useEffect(() => {
    if (!cardRef.current) return

    const showNewDesign =
      getMeta('ol-splitTestVariants')?.['design-system-updates'] === 'enabled'

    const style = showNewDesign
      ? {
          fontColor: '#1b222c',
          placeholder: {
            color: '#677283',
          },
          invalid: {
            fontColor: '#b83a33',
          },
        }
      : {
          fontColor: '#5d6879',
          placeholder: {},
          invalid: {
            fontColor: '#a93529',
          },
        }

    const card = elements.CardElement({
      displayIcon: true,
      inputType: 'mobileSelect',
      style,
    })

    card.attach(cardRef.current)
    card.on('change', state => {
      setShowCardElementInvalid(!state.focus && !state.empty && !state.valid)
      onChange(state)
    })

    return () => {
      cardRef.current = null
    }
  }, [elements, onChange])

  return (
    <FormGroup
      className={classnames(className, { 'has-error': showCardElementInvalid })}
    >
      <ControlLabel>{t('card_details')}</ControlLabel>
      <div ref={cardRef} />
      {showCardElementInvalid && (
        <span className="input-feedback-message">
          {t('card_details_are_not_valid')}
        </span>
      )}
    </FormGroup>
  )
}

export default CardElement
