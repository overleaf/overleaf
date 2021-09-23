import sinon from 'sinon'
import { expect } from 'chai'
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import usePersistedState from '../../../../frontend/js/shared/hooks/use-persisted-state'
import localStorage from '../../../../frontend/js/infrastructure/local-storage'

describe('usePersistedState', function () {
  beforeEach(function () {
    sinon.spy(global.localStorage, 'getItem')
    sinon.spy(global.localStorage, 'removeItem')
    sinon.spy(global.localStorage, 'setItem')
  })

  afterEach(function () {
    sinon.restore()
  })

  it('reads the value from localStorage', function () {
    const key = 'test'
    localStorage.setItem(key, 'foo')
    expect(global.localStorage.setItem).to.have.callCount(1)

    const Test = () => {
      const [value] = usePersistedState(key)

      return <div>{value}</div>
    }

    render(<Test />)
    screen.getByText('foo')

    expect(global.localStorage.getItem).to.have.callCount(1)
    expect(global.localStorage.removeItem).to.have.callCount(0)
    expect(global.localStorage.setItem).to.have.callCount(1)

    expect(localStorage.getItem(key)).to.equal('foo')
  })

  it('uses the default value without storing anything', function () {
    const key = 'test:default'

    const Test = () => {
      const [value] = usePersistedState(key, 'foo')

      return <div>{value}</div>
    }

    render(<Test />)
    screen.getByText('foo')

    expect(global.localStorage.getItem).to.have.callCount(1)
    expect(global.localStorage.removeItem).to.have.callCount(0)
    expect(global.localStorage.setItem).to.have.callCount(0)

    expect(localStorage.getItem(key)).to.be.null
  })

  it('stores the new value in localStorage', function () {
    const key = 'test:store'
    localStorage.setItem(key, 'foo')
    expect(global.localStorage.setItem).to.have.callCount(1)

    const Test = () => {
      const [value, setValue] = usePersistedState(key, 'bar')

      useEffect(() => {
        setValue('baz')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('baz')

    expect(global.localStorage.getItem).to.have.callCount(1)
    expect(global.localStorage.removeItem).to.have.callCount(0)
    expect(global.localStorage.setItem).to.have.callCount(2)

    expect(localStorage.getItem(key)).to.equal('baz')
  })

  it('removes the value from localStorage if it equals the default value', function () {
    const key = 'test:store-default'
    localStorage.setItem(key, 'foo')
    expect(global.localStorage.setItem).to.have.callCount(1)

    const Test = () => {
      const [value, setValue] = usePersistedState(key, 'bar')

      useEffect(() => {
        // set a different value
        setValue('baz')
        expect(localStorage.getItem(key)).to.equal('baz')

        // set the default value again
        setValue('bar')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('bar')

    expect(global.localStorage.getItem).to.have.callCount(2)
    expect(global.localStorage.removeItem).to.have.callCount(1)
    expect(global.localStorage.setItem).to.have.callCount(2)

    expect(localStorage.getItem(key)).to.be.null
  })

  it('handles function values', function () {
    const key = 'test:store'
    localStorage.setItem(key, 'foo')
    expect(global.localStorage.setItem).to.have.callCount(1)

    const Test = () => {
      const [value, setValue] = usePersistedState(key)

      useEffect(() => {
        setValue(value => value + 'bar')
      }, [setValue])

      return <div>{value}</div>
    }

    render(<Test />)

    screen.getByText('foobar')

    expect(global.localStorage.getItem).to.have.callCount(1)
    expect(global.localStorage.removeItem).to.have.callCount(0)
    expect(global.localStorage.setItem).to.have.callCount(2)

    expect(localStorage.getItem(key)).to.equal('foobar')
  })
})
