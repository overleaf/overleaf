import { FC } from 'react'
import Icon from '../../../../shared/components/icon'
import Tooltip from '../../../../shared/components/tooltip'
import {
  useFigureModalContext,
  useFigureModalExistingFigureContext,
} from './figure-modal-context'
import { Switcher, SwitcherItem } from '../../../../shared/components/switcher'

export const FigureModalFigureOptions: FC = () => {
  const { includeCaption, includeLabel, dispatch, width } =
    useFigureModalContext()

  const { hasComplexGraphicsArgument } = useFigureModalExistingFigureContext()
  return (
    <>
      <div className="figure-modal-checkbox-input">
        <input
          type="checkbox"
          id="figure-modal-caption"
          defaultChecked={includeCaption}
          onChange={event => dispatch({ includeCaption: event.target.checked })}
        />
        <label className="figure-modal-label" htmlFor="figure-modal-caption">
          Include caption
        </label>
      </div>
      <div className="figure-modal-checkbox-input">
        <input
          type="checkbox"
          id="figure-modal-label"
          defaultChecked={includeLabel}
          onChange={event => dispatch({ includeLabel: event.target.checked })}
        />
        <label htmlFor="figure-modal-label" className="mb-0 figure-modal-label">
          Include label
          <br />
          <span className="text-muted text-small figure-modal-label-description">
            Used when referring to the figure elsewhere in the document
          </span>
        </label>
      </div>
      <div className="figure-modal-switcher-input">
        <div>
          Image width{' '}
          {hasComplexGraphicsArgument ? (
            <Tooltip
              id="figure-modal-image-width-warning-tooltip"
              description="A custom size has been used in the LaTeX code."
              overlayProps={{ delay: 0, placement: 'top' }}
            >
              <Icon type="exclamation-triangle" fw />
            </Tooltip>
          ) : (
            <Tooltip
              id="figure-modal-image-width-tooltip"
              description="The width you choose here is based on the width of the text in your document. Alternatively, you can customize the image size directly in the LaTeX code."
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
            defaultValue={width === 1 ? '1.0' : width.toString()}
            disabled={hasComplexGraphicsArgument}
          >
            <SwitcherItem value="0.25" label="¼ width" />
            <SwitcherItem value="0.5" label="½ width" />
            <SwitcherItem value="0.75" label="¾ width" />
            <SwitcherItem value="1.0" label="Full width" />
          </Switcher>
        </div>
      </div>
    </>
  )
}
