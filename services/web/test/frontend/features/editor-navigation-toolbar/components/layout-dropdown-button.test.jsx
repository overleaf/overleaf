import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import { expect } from 'chai'
import { fireEvent, screen } from '@testing-library/react'
import LayoutDropdownButton from '../../../../../frontend/js/features/editor-navigation-toolbar/components/layout-dropdown-button'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import * as eventTracking from '@/infrastructure/event-tracking'

describe('<LayoutDropdownButton />', function () {
  let openStub
  let sendMBSpy
  const defaultUi = {
    pdfLayout: 'flat',
    view: 'pdf',
  }

  beforeEach(function () {
    openStub = sinon.stub(window, 'open')
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    openStub.restore()
    sendMBSpy.restore()
    fetchMock.restore()
  })

  it('should mark current layout option as selected', function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, { ui: defaultUi })
    screen.getByRole('menuitem', {
      name: 'Editor & PDF',
    })
    screen.getByRole('menuitem', {
      name: 'Selected PDF only (hide editor)',
    })
    screen.getByRole('menuitem', {
      name: 'Editor only (hide PDF)',
    })
    screen.getByRole('menuitem', {
      name: 'PDF in separate tab',
    })
  })

  it('should not select any option in history view', function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, {
      ui: { ...defaultUi, view: 'history' },
    })
    screen.getByRole('menuitem', {
      name: 'Editor & PDF',
    })
    screen.getByRole('menuitem', {
      name: 'PDF only (hide editor)',
    })
    screen.getByRole('menuitem', {
      name: 'Editor only (hide PDF)',
    })
    screen.getByRole('menuitem', {
      name: 'PDF in separate tab',
    })
  })

  it('should treat file and editor views the same way', function () {
    // Selected is aria-label, visually we show a checkmark
    renderWithEditorContext(<LayoutDropdownButton />, {
      ui: {
        pdfLayout: 'flat',
        view: 'file',
      },
    })
    screen.getByRole('menuitem', {
      name: 'Editor & PDF',
    })
    screen.getByRole('menuitem', {
      name: 'PDF only (hide editor)',
    })
    screen.getByRole('menuitem', {
      name: 'Selected Editor only (hide PDF)',
    })
    screen.getByRole('menuitem', {
      name: 'PDF in separate tab',
    })
  })

  describe('on detach', function () {
    let originalBroadcastChannel
    beforeEach(function () {
      window.BroadcastChannel = originalBroadcastChannel || true // ensure that window.BroadcastChannel is truthy

      renderWithEditorContext(<LayoutDropdownButton />, {
        ui: { ...defaultUi, view: 'editor' },
      })

      const menuItem = screen.getByRole('menuitem', {
        name: 'PDF in separate tab',
      })
      fireEvent.click(menuItem)
    })

    afterEach(function () {
      window.BroadcastChannel = originalBroadcastChannel
    })

    it('should show processing', function () {
      screen.getByText('Layout processing')
    })

    it('should record event', function () {
      sinon.assert.calledWith(sendMBSpy, 'project-layout-detach')
    })
  })

  describe('on layout change / reattach', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-detachRole', 'detacher')
      renderWithEditorContext(<LayoutDropdownButton />, {
        ui: { ...defaultUi, view: 'editor' },
      })

      const menuItem = screen.getByRole('menuitem', {
        name: 'Editor only (hide PDF)',
      })
      fireEvent.click(menuItem)
    })

    it('should not show processing', function () {
      const processingText = screen.queryByText('Layout processing')
      expect(processingText).to.not.exist
    })

    it('should record events', function () {
      sinon.assert.calledWith(sendMBSpy, 'project-layout-reattach')
      sinon.assert.calledWith(sendMBSpy, 'project-layout-change', {
        layout: 'flat',
        view: 'editor',
        page: '/detacher',
      })
    })

    it('should select new menu item', function () {
      screen.getByRole('menuitem', {
        name: 'Selected Editor only (hide PDF)',
      })
    })
  })
})
