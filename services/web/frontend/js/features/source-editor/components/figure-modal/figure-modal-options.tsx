import { FC } from 'react'
import Icon from '../../../../shared/components/icon'
import Tooltip from '../../../../shared/components/tooltip'
import {
  useFigureModalContext,
  useFigureModalExistingFigureContext,
} from './figure-modal-context'
import { Switcher, SwitcherItem } from '../../../../shared/components/switcher'
import { useTranslation } from 'react-i18next'

export const FigureModalFigureOptions: FC = () => {
  const { t } = useTranslation()
  const { includeCaption, includeLabel, dispatch, width } =
    useFigureModalContext()

  const { hasComplexGraphicsArgument } = useFigureModalExistingFigureContext()
  return (
    <>
      <div className="figure-modal-checkbox-input">
        <input
          type="checkbox"
          id="figure-modal-caption"
          data-cy="include-caption-option"
          defaultChecked={includeCaption}
          onChange={event => dispatch({ includeCaption: event.target.checked })}
        />
        <label className="figure-modal-label" htmlFor="figure-modal-caption">
          {t('include_caption')}
        </label>
      </div>
      <div className="figure-modal-checkbox-input">
        <input
          type="checkbox"
          id="figure-modal-label"
          data-cy="include-label-option"
          defaultChecked={includeLabel}
          onChange={event => dispatch({ includeLabel: event.target.checked })}
        />
        <label htmlFor="figure-modal-label" className="mb-0 figure-modal-label">
          {t('include_label')}
          <br />
          <span className="text-muted text-small figure-modal-label-description">
            {t('used_when_referring_to_the_figure_elsewhere_in_the_document')}
          </span>
        </label>
      </div>
      <div className="figure-modal-switcher-input">
        <div>
          {t('image_width')}{' '}
          {hasComplexGraphicsArgument ? (
            <Tooltip
              id="figure-modal-image-width-warning-tooltip"
              description={t('a_custom_size_has_been_used_in_the_latex_code')}
              overlayProps={{ delay: 0, placement: 'top' }}
            >
              <Icon type="exclamation-triangle" fw />
            </Tooltip>
          ) : (
            <Tooltip
              id="figure-modal-image-width-tooltip"
              description={t(
                'the_width_you_choose_here_is_based_on_the_width_of_the_text_in_your_document'
              )}
              overlayProps={{ delay: 0, placement: 'bottom' }}
            >
              <Icon type="question-circle" fw />
            </Tooltip>
          )}
        </div>
        <div>
          <Switcher
            name="figure-width"
            onChange={value => dispatch({ width: parseFloat(value) })}
            defaultValue={width === 1 ? '1.0' : width?.toString()}
            disabled={hasComplexGraphicsArgument}
          >
            <SwitcherItem value="0.25" label={t('1_4_width')} />
            <SwitcherItem value="0.5" label={t('1_2_width')} />
            <SwitcherItem value="0.75" label={t('3_4_width')} />
            <SwitcherItem value="1.0" label={t('full_width')} />
          </Switcher>
        </div>
      </div>
    </>
  )
}
