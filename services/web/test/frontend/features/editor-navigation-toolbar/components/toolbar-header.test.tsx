import { expect } from 'chai'
import { screen } from '@testing-library/react'

import ToolbarHeader, {
  type ToolbarHeaderProps,
} from '../../../../../frontend/js/features/editor-navigation-toolbar/components/toolbar-header'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

describe('<ToolbarHeader />', function () {
  const defaultProps: ToolbarHeaderProps = {
    onShowLeftMenuClick: () => {},
    toggleChatOpen: () => {},
    toggleReviewPanelOpen: () => {},
    toggleHistoryOpen: () => {},
    unreadMessageCount: 0,
    onlineUsers: [],
    goToUser: (async () => {}) as any,
    projectName: 'test project',
    renameProject: () => {},
    openShareModal: () => {},
    hasPublishPermissions: true,
    chatVisible: true,
    trackChangesVisible: true,
    cobranding: undefined,
    isRestrictedTokenMember: false,
    hasRenamePermissions: true,
    historyIsOpen: false,
    chatIsOpen: false,
    reviewPanelOpen: false,
  }

  beforeEach(function () {
    window.metaAttributesCache.set('ol-preventCompileOnLoad', true)
  })

  describe('cobranding logo', function () {
    it('is not displayed by default', function () {
      renderWithEditorContext(<ToolbarHeader {...defaultProps} />)
      expect(screen.queryByRole('link', { name: 'variation' })).to.not.exist
    })

    it('is displayed when cobranding data is available', function () {
      const props = {
        ...defaultProps,
        cobranding: {
          brandId: 12,
          brandVariationId: 12,
          brandVariationHomeUrl: 'http://cobranding',
          brandVariationName: 'variation',
          logoImgUrl: 'http://cobranding/logo',
        },
      }
      renderWithEditorContext(<ToolbarHeader {...props} />)
      screen.getByRole('link', { name: 'variation' })
    })
  })

  describe('track changes toggle button', function () {
    it('is displayed by default', function () {
      renderWithEditorContext(<ToolbarHeader {...defaultProps} />)
      screen.getByText('Review')
    })

    it('is not displayed when "trackChangesVisible" prop is set to false', function () {
      const props = {
        ...defaultProps,
        trackChangesVisible: false,
      }
      renderWithEditorContext(<ToolbarHeader {...props} />)
      expect(screen.queryByText('Review')).to.not.exist
    })
  })

  describe('History toggle button', function () {
    it('is displayed by default', function () {
      renderWithEditorContext(<ToolbarHeader {...defaultProps} />)
      screen.getByText('History')
    })

    it('is not displayed when "isRestrictedTokenMember" prop is set to true', function () {
      const props = {
        ...defaultProps,
        isRestrictedTokenMember: true,
      }
      renderWithEditorContext(<ToolbarHeader {...props} />)
      expect(screen.queryByText('History')).to.not.exist
    })
  })

  describe('Chat toggle button', function () {
    it('is displayed by default', function () {
      renderWithEditorContext(<ToolbarHeader {...defaultProps} />)
      screen.getByText('Chat')
    })

    it('is not displayed when "chatVisible" prop is set to false', function () {
      const props = {
        ...defaultProps,
        chatVisible: false,
      }
      renderWithEditorContext(<ToolbarHeader {...props} />)
      expect(screen.queryByText('Chat')).to.not.exist
    })
  })

  describe('Publish button', function () {
    it('is displayed by default', function () {
      renderWithEditorContext(<ToolbarHeader {...defaultProps} />)
      screen.getByText('Submit')
    })

    it('is not displayed for users with no publish permissions', function () {
      const props = {
        ...defaultProps,
        hasPublishPermissions: false,
      }
      renderWithEditorContext(<ToolbarHeader {...props} />)
      expect(screen.queryByText('Submit')).to.not.exist
    })
  })
})
