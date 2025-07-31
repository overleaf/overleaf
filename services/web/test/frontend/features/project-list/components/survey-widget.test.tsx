import { expect } from 'chai'
import { fireEvent, render, screen } from '@testing-library/react'
import { SurveyWidgetDsNav } from '@/features/project-list/components/survey-widget-ds-nav'
import { SplitTestProvider } from '@/shared/context/split-test-context'

describe('<SurveyWidgetDsNav />', function () {
  beforeEach(function () {
    this.name = 'my-survey'
    this.title = 'To help shape the future of Overleaf'
    this.text = 'Click here!'
    this.cta = 'Let’s go!'
    this.url = 'https://example.com/my-survey'

    localStorage.clear()
  })

  describe('survey widget is visible', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-survey', {
        name: this.name,
        title: this.title,
        text: this.text,
        url: this.url,
      })

      render(
        <SplitTestProvider>
          <SurveyWidgetDsNav />
        </SplitTestProvider>
      )
    })

    it('shows text and link', function () {
      const dismissed = localStorage.getItem('dismissed-my-survey')
      expect(dismissed).to.equal(null)

      screen.getByText(this.title)
      screen.getByText(this.text)

      const link = screen.getByRole('link', {
        name: 'Take survey',
      }) as HTMLAnchorElement
      expect(link.href).to.equal(this.url)
    })

    it('it is dismissed on click on the dismiss button', function () {
      const dismissButton = screen.getByRole('button', {
        name: 'Close',
      })
      fireEvent.click(dismissButton)

      const text = screen.queryByText(this.title)
      expect(text).to.be.null

      const link = screen.queryByRole('button')
      expect(link).to.be.null

      const dismissed = localStorage.getItem('dismissed-my-survey')
      expect(dismissed).to.equal('true')
    })
  })

  describe('survey widget is visible with custom CTA', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-survey', {
        name: this.name,
        title: this.title,
        text: this.text,
        cta: this.cta,
        url: this.url,
      })

      render(
        <SplitTestProvider>
          <SurveyWidgetDsNav />
        </SplitTestProvider>
      )
    })

    it('shows text and link with custom CTA', function () {
      const dismissed = localStorage.getItem('dismissed-my-survey')
      expect(dismissed).to.equal(null)

      screen.getByText(this.title)
      screen.getByText(this.text)

      const link = screen.getByRole('link', {
        name: this.cta,
      }) as HTMLAnchorElement
      expect(link.href).to.equal(this.url)
    })
  })

  describe('survey widget is not shown when already dismissed', function () {
    beforeEach(function () {
      window.metaAttributesCache.set('ol-survey', {
        name: this.name,
        title: this.title,
        text: this.text,
        url: this.url,
      })
      localStorage.setItem('dismissed-my-survey', 'true')

      render(
        <SplitTestProvider>
          <SurveyWidgetDsNav />
        </SplitTestProvider>
      )
    })

    it('nothing is displayed', function () {
      const text = screen.queryByText(this.title)
      expect(text).to.be.null

      const link = screen.queryByRole('button')
      expect(link).to.be.null
    })
  })

  describe('survey widget is not shown when no survey is configured', function () {
    beforeEach(function () {
      render(
        <SplitTestProvider>
          <SurveyWidgetDsNav />
        </SplitTestProvider>
      )
    })

    it('nothing is displayed', function () {
      const text = screen.queryByText(this.title)
      expect(text).to.be.null

      const link = screen.queryByRole('button')
      expect(link).to.be.null
    })
  })
})
