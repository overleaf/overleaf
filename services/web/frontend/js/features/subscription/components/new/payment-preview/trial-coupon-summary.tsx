import TrialPrice from './trial-price'
import NoDiscountPrice from './no-discount-price'
import PriceForFirstXPeriod from './price-for-first-x-period'

function TrialCouponSummary() {
  const children = [TrialPrice, NoDiscountPrice, PriceForFirstXPeriod].map(
    (Component, index) => <Component key={index} />
  )

  const showChildren = children.some(child => child.type() != null)

  if (!showChildren) return null

  return (
    <>
      <hr className="thin" />
      <div className="trial-coupon-summary" data-testid="trial-coupon-summary">
        {children}
      </div>
    </>
  )
}

export default TrialCouponSummary
