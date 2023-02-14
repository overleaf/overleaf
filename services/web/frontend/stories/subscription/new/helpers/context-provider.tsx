import { PaymentContext } from '../../../../js/features/subscription/context/payment-context'
import { PaymentContextValue } from '../../../../js/features/subscription/context/types/payment-context-value'

type PaymentProviderProps = {
  children: React.ReactNode
  value: PaymentContextValue
}

export function PaymentProvider({ value, children }: PaymentProviderProps) {
  return (
    <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>
  )
}
