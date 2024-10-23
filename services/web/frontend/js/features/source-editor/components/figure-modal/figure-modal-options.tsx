import { FC } from 'react'
import Icon from '@/shared/components/icon'
import {
  useFigureModalContext,
  useFigureModalExistingFigureContext,
} from './figure-modal-context'
import { useTranslation } from 'react-i18next'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLFormCheckbox from '@/features/ui/components/ol/ol-form-checkbox'
import OLFormText from '@/features/ui/components/ol/ol-form-text'
import OLToggleButtonGroup from '@/features/ui/components/ol/ol-toggle-button-group'
import OLToggleButton from '@/features/ui/components/ol/ol-toggle-button'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'

export const FigureModalFigureOptions: FC = () => {
  const { t } = useTranslation()
  const { includeCaption, includeLabel, dispatch, width } =
    useFigureModalContext()

  const { hasComplexGraphicsArgument } = useFigureModalExistingFigureContext()
  return (
    <>
      <OLFormGroup>
        <OLFormCheckbox
          id="figure-modal-caption"
          data-cy="include-caption-option"
          defaultChecked={includeCaption}
          onChange={event => dispatch({ includeCaption: event.target.checked })}
          className={bsVersion({ bs3: 'figure-modal-checkbox-input' })}
          label={t('include_caption')}
        />
      </OLFormGroup>
      <OLFormGroup>
        <OLFormCheckbox
          id="figure-modal-label"
          data-cy="include-label-option"
          defaultChecked={includeLabel}
          onChange={event => dispatch({ includeLabel: event.target.checked })}
          className={bsVersion({ bs3: 'figure-modal-checkbox-input' })}
          label={
            <span className="figure-modal-label-content">
              {t('include_label')}
              <OLFormText className={bsVersion({ bs3: 'mt-1 text-muted' })}>
                {t(
                  'used_when_referring_to_the_figure_elsewhere_in_the_document'
                )}
              </OLFormText>
            </span>
          }
        />
      </OLFormGroup>
      <OLFormGroup className="mb-0">
        <div className="figure-modal-switcher-input">
          <div>
            {t('image_width')}{' '}
            {hasComplexGraphicsArgument ? (
              <OLTooltip
                id="figure-modal-image-width-warning-tooltip"
                description={t('a_custom_size_has_been_used_in_the_latex_code')}
                overlayProps={{ delay: 0, placement: 'top' }}
              >
                <span>
                  <BootstrapVersionSwitcher
                    bs3={<Icon type="exclamation-triangle" fw />}
                    bs5={
                      <MaterialIcon
                        type="warning"
                        className="align-text-bottom"
                      />
                    }
                  />
                </span>
              </OLTooltip>
            ) : (
              <OLTooltip
                id="figure-modal-image-width-tooltip"
                description={t(
                  'the_width_you_choose_here_is_based_on_the_width_of_the_text_in_your_document'
                )}
                overlayProps={{ delay: 0, placement: 'bottom' }}
              >
                <span>
                  <BootstrapVersionSwitcher
                    bs3={<Icon type="question-circle" fw />}
                    bs5={
                      <MaterialIcon type="help" className="align-text-bottom" />
                    }
                  />
                </span>
              </OLTooltip>
            )}
          </div>
          <OLToggleButtonGroup
            type="radio"
            name="figure-width"
            onChange={value => dispatch({ width: parseFloat(value) })}
            defaultValue={width === 1 ? '1.0' : width?.toString()}
            aria-label={t('image_width')}
          >
            <OLToggleButton
              variant="secondary"
              id="width-25p"
              disabled={hasComplexGraphicsArgument}
              value="0.25"
            >
              {t('1_4_width')}
            </OLToggleButton>
            <OLToggleButton
              variant="secondary"
              id="width-50p"
              disabled={hasComplexGraphicsArgument}
              value="0.5"
            >
              {t('1_2_width')}
            </OLToggleButton>
            <OLToggleButton
              variant="secondary"
              id="width-75p"
              disabled={hasComplexGraphicsArgument}
              value="0.75"
            >
              {t('3_4_width')}
            </OLToggleButton>
            <OLToggleButton
              variant="secondary"
              id="width-100p"
              disabled={hasComplexGraphicsArgument}
              value="1.0"
            >
              {t('full_width')}
            </OLToggleButton>
          </OLToggleButtonGroup>
        </div>
      </OLFormGroup>
    </>
  )
}
