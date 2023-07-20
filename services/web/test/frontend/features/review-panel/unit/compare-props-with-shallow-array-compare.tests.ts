import { expect } from 'chai'
import comparePropsWithShallowArrayCompare from '../../../../../frontend/js/features/source-editor/components/review-panel/utils/compare-props-with-shallow-array-compare'

describe('comparePropsWithShallowArrayCompare', function () {
  it('is true with all equal non-array props', function () {
    type NoArrayProps = { prop1: string; prop2: number }

    const props1: NoArrayProps = { prop1: 'wombat', prop2: 1 }
    const props2: NoArrayProps = { prop1: 'wombat', prop2: 1 }

    expect(comparePropsWithShallowArrayCompare()(props1, props2)).to.be.true
  })

  it('is false with non-equal non-array props', function () {
    type NoArrayProps = { prop1: string; prop2: number }

    const props1: NoArrayProps = { prop1: 'wombat', prop2: 1 }
    const props2: NoArrayProps = { prop1: 'squirrel', prop2: 1 }

    expect(comparePropsWithShallowArrayCompare()(props1, props2)).to.be.false
  })

  it('is false with similar but not specified array prop', function () {
    type ArrayProps = { prop1: string; prop2: number[] }

    const props1: ArrayProps = { prop1: 'wombat', prop2: [1] }
    const props2: ArrayProps = { prop1: 'wombat', prop2: [1] }

    expect(comparePropsWithShallowArrayCompare()(props1, props2)).to.be.false
  })

  it('is true with similar and specified array prop', function () {
    type ArrayProps = { prop1: string; prop2: number[] }

    const props1: ArrayProps = { prop1: 'wombat', prop2: [1] }
    const props2: ArrayProps = { prop1: 'wombat', prop2: [1] }

    expect(
      comparePropsWithShallowArrayCompare<ArrayProps>('prop2')(props1, props2)
    ).to.be.true
  })

  it('is false with non-similar and specified array prop', function () {
    type ArrayProps = { prop1: string; prop2: number[] }

    const props1: ArrayProps = { prop1: 'wombat', prop2: [1] }
    const props2: ArrayProps = { prop1: 'wombat', prop2: [2] }

    expect(
      comparePropsWithShallowArrayCompare<ArrayProps>('prop2')(props1, props2)
    ).to.be.false
  })

  it('is false with multiple similar array props with not all specified', function () {
    type MultipleArrayProps = { prop1: number[]; prop2: number[] }

    const props1: MultipleArrayProps = { prop1: [1], prop2: [2] }
    const props2: MultipleArrayProps = { prop1: [1], prop2: [2] }

    expect(
      comparePropsWithShallowArrayCompare<MultipleArrayProps>('prop1')(
        props1,
        props2
      )
    ).to.be.false
  })

  it('is true with multiple similar array props with all specified', function () {
    type MultipleArrayProps = { prop1: number[]; prop2: number[] }

    const props1: MultipleArrayProps = { prop1: [1], prop2: [2] }
    const props2: MultipleArrayProps = { prop1: [1], prop2: [2] }

    expect(
      comparePropsWithShallowArrayCompare<MultipleArrayProps>('prop1', 'prop2')(
        props1,
        props2
      )
    ).to.be.true
  })
})
