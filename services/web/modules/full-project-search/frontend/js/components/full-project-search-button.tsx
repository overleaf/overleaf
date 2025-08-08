import React, { FC, useMemo } from 'react'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import classnames from 'classnames'
import MaterialIcon from '@/shared/components/material-icon'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useTranslation } from 'react-i18next'
import { TooltipProps } from '@/shared/components/tooltip'
import { isMac } from '@/shared/utils/os'
import { sendSearchEvent } from '@/features/event-tracking/search-events'

const FullProjectSearchButton: FC = () => {
  const { projectSearchIsOpen, setProjectSearchIsOpen } = useLayoutContext()
  const { t } = useTranslation()

  const tooltipProps: Pick<
    TooltipProps,
    'id' | 'description' | 'overlayProps'
  > = useMemo(
    () => ({
      id: 'search',
      description: (
        <>
          <div>{t('search_project')}</div>
          <div>{isMac ? '⇧⌘F' : 'Ctrl+Shift+F'}</div>
        </>
      ),
      overlayProps: { placement: 'bottom' },
    }),
    [t]
  )

  return (
    <OLTooltip {...tooltipProps}>
      <button
        className={classnames('btn', {
          active: projectSearchIsOpen,
        })}
        onClick={() => {
          if (!projectSearchIsOpen) {
            sendSearchEvent('search-open', {
              searchType: 'full-project',
              method: 'button',
              location: 'toolbar',
            })
          }
          setProjectSearchIsOpen(value => !value)
        }}
        tabIndex={-1}
        data-active={projectSearchIsOpen}
      >
        <MaterialIcon type="search" accessibilityLabel={t('search')} />
      </button>
    </OLTooltip>
  )
}

export default FullProjectSearchButton
