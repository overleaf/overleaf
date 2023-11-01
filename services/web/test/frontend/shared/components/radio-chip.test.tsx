import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import RadioChip from '@/shared/components/radio-chip'

describe('<RadioChip />', function () {
  const defaultProps = {
    name: 'test',
    label: 'Test',
    value: 'testValue',
    onChange: () => {},
  }

  describe('component renders and with label', function () {
    it('renders and label is provided', function () {
      render(<RadioChip {...defaultProps} />)
      screen.getByText('Test')
    })
  })

  describe('props', function () {
    it('should be checked when the checked prop is provided', function () {
      render(<RadioChip {...defaultProps} checked />)
      const radioChip = screen.getByRole('radio') as HTMLInputElement
      expect(radioChip.checked).to.equal(true)
    })

    it('should be disabled when the disabled prop is provided', function () {
      render(<RadioChip {...defaultProps} disabled />)
      const radioChip = screen.getByRole('radio') as HTMLInputElement
      expect(radioChip.disabled).to.equal(true)
    })

    it('should have the required attribute when the required prop is provided', function () {
      render(<RadioChip {...defaultProps} required />)
      const radioChip = screen.getByRole('radio') as HTMLInputElement
      expect(radioChip.required).to.equal(true)
    })

    it('should use the provided name prop', function () {
      render(<RadioChip {...defaultProps} name="testName" />)
      const radioChip = screen.getByRole('radio') as HTMLInputElement
      expect(radioChip.name).to.equal('testName')
    })

    it('should use the provided value prop', function () {
      render(<RadioChip {...defaultProps} />)
      const radioChip = screen.getByRole('radio') as HTMLInputElement
      expect(radioChip.value).to.equal('testValue')
    })

    it('should have the data-disabled attribute when the disabled prop is provided', function () {
      render(<RadioChip {...defaultProps} disabled />)
      const label = screen.getByText('Test')?.closest('label')
      expect(label?.getAttribute('data-disabled')).to.equal('true')
    })
  })
})
