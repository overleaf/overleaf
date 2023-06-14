import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import Icon from '../../../../../shared/components/icon'
import Tooltip from '../../../../../shared/components/tooltip'
import ResolvedCommentsScroller from './resolved-comments-scroller'
import classnames from 'classnames'

function ResolvedCommentsDropdown() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  // TODO setIsLoading
  // eslint-disable-next-line no-unused-vars
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="resolved-comments">
      <div
        aria-hidden="true"
        className={classnames('resolved-comments-backdrop', {
          'resolved-comments-backdrop-visible': isOpen,
        })}
        onClick={() => setIsOpen(false)}
      />

      <Tooltip
        id="resolved-comments-toggle"
        description={t('resolved_comments')}
        overlayProps={{ container: document.body, placement: 'bottom' }}
      >
        <button
          className="resolved-comments-toggle"
          onClick={() => setIsOpen(value => !value)}
          aria-label={t('resolved_comments')}
        >
          <Icon type="inbox" />
        </button>
      </Tooltip>

      <div
        className={classnames('resolved-comments-dropdown', {
          'resolved-comments-dropdown-open': isOpen,
        })}
      >
        {isLoading ? (
          <div className="rp-loading">
            <Icon type="spinner" spin />
          </div>
        ) : (
          <ResolvedCommentsScroller
            resolvedComments={[
              {
                resolved_at: 12345,
                entryId: '123',
                docName: 'demo name',
                content: 'demo content',
                messages: [
                  {
                    id: '123',
                    user: {
                      id: '123',
                      hue: 'abcde',
                      name: 'demo name',
                    },
                    content: 'demo content',
                    timestamp: '12345',
                  },
                ],
                resolved_by_user: {
                  name: 'demo',
                  hue: 'abcde',
                },
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}

export default ResolvedCommentsDropdown
