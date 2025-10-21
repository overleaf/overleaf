import { useState, useEffect, useMemo, useRef } from 'react'
import { debounce } from 'lodash'
import { Trans, useTranslation } from 'react-i18next'
import withErrorBoundary from '@/infrastructure/error-boundary'
import useAbortController from '@/shared/hooks/use-abort-controller'
import LoadingSpinner from '@/shared/components/loading-spinner'
import Notification from '@/shared/components/notification'
import IconButton from '@/shared/components/button/icon-button'
import {
  Card,
  Row,
  Col,
  FormGroup,
  FormLabel,
  FormControl,
} from 'react-bootstrap'
import FormText from '@/shared/components/form/form-text'
import Button from '@/shared/components/button/button'
import PoNumber from '@/features/group-management/components/add-seats/po-number'
import CostSummary from '@/features/group-management/components/add-seats/cost-summary'
import RequestStatus from '@/features/group-management/components/request-status'
import useAsync from '@/shared/hooks/use-async'
import useAsyncWithCancel from '@/shared/hooks/use-async-with-cancel'
import getMeta from '@/utils/meta'
import { FetchError, postJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import * as yup from 'yup'
import {
  AddOnUpdate,
  SubscriptionChangePreview,
} from '../../../../../../types/subscription/subscription-change-preview'
import { MergeAndOverride, Nullable } from '../../../../../../types/utils'
import { sendMB } from '../../../../infrastructure/event-tracking'
import handleStripePaymentAction from '@/features/subscription/util/handle-stripe-payment-action'

export const MAX_NUMBER_OF_USERS = 20
export const MAX_NUMBER_OF_PO_NUMBER_CHARACTERS = 50

type CostSummaryData = MergeAndOverride<
  SubscriptionChangePreview,
  { change: AddOnUpdate }
>

function AddSeats() {
  const { t } = useTranslation()
  const groupName = getMeta('ol-groupName')
  const subscriptionId = getMeta('ol-subscriptionId')
  const totalLicenses = getMeta('ol-totalLicenses')
  const isProfessional = getMeta('ol-isProfessional')
  const isCollectionMethodManual = getMeta('ol-isCollectionMethodManual')
  const isRedirectedPaymentError = Boolean(
    getMeta('ol-subscriptionPaymentErrorCode')
  )
  const [addSeatsInputError, setAddSeatsInputError] = useState<string>()
  const [poNumberInputError, setPoNumberInputError] = useState<string>()
  const [shouldContactSales, setShouldContactSales] = useState(false)
  const { signal: addSeatsSignal } = useAbortController()
  const { signal: contactSalesSignal } = useAbortController()
  const {
    isLoading: isLoadingCostSummary,
    isError: isErrorCostSummary,
    runAsync: runAsyncCostSummary,
    data: costSummaryData,
    reset: resetCostSummaryData,
    error: errorCostSummary,
    cancelAll: cancelCostSummaryRequest,
  } = useAsyncWithCancel<CostSummaryData, FetchError>()
  const [isAddingSeats, setIsAddingSeats] = useState(false)
  const [isErrorAddingSeats, setIsErrorAddingSeats] = useState(false)
  const [isSuccessAddingSeats, setIsSuccessAddingSeats] = useState(false)
  const [addedSeatsData, setAddedSeatsData] = useState<{
    adding: number
  } | null>(null)
  const {
    isLoading: isSendingMailToSales,
    isError: isErrorSendingMailToSales,
    isSuccess: isSuccessSendingMailToSales,
    runAsync: runAsyncSendMailToSales,
  } = useAsync()

  const addSeatsValidationSchema = useMemo(() => {
    return yup
      .number()
      .typeError(t('value_must_be_a_number'))
      .integer(t('value_must_be_a_whole_number'))
      .min(1, t('value_must_be_at_least_x', { value: 1 }))
      .required(t('this_field_is_required'))
  }, [t])

  const debouncedCostSummaryRequest = useMemo(
    () =>
      debounce((value: number) => {
        cancelCostSummaryRequest()
        const post = (signal: AbortSignal) =>
          postJSON('/user/subscription/group/add-users/preview', {
            body: { adding: value },
            signal,
          })

        runAsyncCostSummary(post).catch(error => {
          if (error.name !== 'AbortError') {
            debugConsole.error(error)
          }
        })
      }, 500),
    [runAsyncCostSummary, cancelCostSummaryRequest]
  )

  const debouncedTrackUserEnterSeatNumberEvent = useMemo(
    () =>
      debounce((value: number) => {
        sendMB('flex-add-users-form', {
          action: 'enter-seat-number',
          seatNumber: value,
        })
      }, 500),
    []
  )

  const validateSeats = async (value: string | undefined) => {
    try {
      await addSeatsValidationSchema.validate(value)
      setAddSeatsInputError(undefined)

      return true
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setAddSeatsInputError(error.errors[0])
      } else {
        debugConsole.error(error)
      }

      return false
    }
  }

  const poNumberValidationSchema = useMemo(() => {
    return yup
      .string()
      .matches(
        /^[\p{L}\p{N}]*$/u,
        t('po_number_can_include_digits_and_letters_only')
      )
      .max(
        MAX_NUMBER_OF_PO_NUMBER_CHARACTERS,
        t('po_number_must_not_exceed_x_characters', {
          count: MAX_NUMBER_OF_PO_NUMBER_CHARACTERS,
        })
      )
  }, [t])

  const validatePoNumber = async (value: string | undefined) => {
    try {
      await poNumberValidationSchema.validate(value)
      setPoNumberInputError(undefined)

      return true
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setPoNumberInputError(error.errors[0])
      } else {
        debugConsole.error(error)
      }

      return false
    }
  }

  const handleSeatsChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? undefined : e.target.value
    const isValidSeatsNumber = await validateSeats(value)
    let shouldContactSales = false

    if (isValidSeatsNumber) {
      const seats = Number(value)
      debouncedTrackUserEnterSeatNumberEvent(seats)

      if (seats > MAX_NUMBER_OF_USERS) {
        debouncedCostSummaryRequest.cancel()
        shouldContactSales = true
      } else {
        debouncedCostSummaryRequest(seats)
      }
    } else {
      debouncedTrackUserEnterSeatNumberEvent.cancel()
      debouncedCostSummaryRequest.cancel()
      cancelCostSummaryRequest()
      resetCostSummaryData()
    }

    setShouldContactSales(shouldContactSales)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const formData = new FormData(e.currentTarget)
    const rawSeats =
      formData.get('seats') === ''
        ? undefined
        : (formData.get('seats') as string)
    const poNumber = !formData.get('po_number')
      ? undefined
      : (formData.get('po_number') as string)

    if (
      !(await validateSeats(rawSeats)) ||
      !(await validatePoNumber(poNumber))
    ) {
      return
    }

    if (shouldContactSales) {
      sendMB('flex-add-users-form', {
        action: 'click-send-request-button',
      })
      const post = postJSON(
        '/user/subscription/group/add-users/sales-contact-form',
        {
          signal: contactSalesSignal,
          body: {
            adding: rawSeats,
            poNumber,
          },
        }
      )
      runAsyncSendMailToSales(post).catch(debugConsole.error)
    } else {
      sendMB('flex-add-users-form', {
        action: 'click-add-user-button',
      })
      setIsAddingSeats(true)
      try {
        const response = await postJSON<{
          adding: number
        }>('/user/subscription/group/add-users/create', {
          signal: addSeatsSignal,
          body: {
            adding: Number(rawSeats),
            poNumber,
          },
        })
        sendMB('flex-add-users-success')
        setIsSuccessAddingSeats(true)
        setAddedSeatsData(response)
      } catch (error) {
        const { handled } = await handleStripePaymentAction(error as FetchError)
        if (handled) {
          sendMB('flex-add-users-success')
          setIsSuccessAddingSeats(true)
          setAddedSeatsData({ adding: Number(rawSeats) })
          return
        }
        debugConsole.error(error)
        sendMB('flex-add-users-error')
        setIsErrorAddingSeats(true)
      } finally {
        setIsAddingSeats(false)
      }
    }
  }

  useEffect(() => {
    return () => {
      debouncedCostSummaryRequest.cancel()
    }
  }, [debouncedCostSummaryRequest])

  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const handleUnload = () => formRef.current?.reset()
    window.addEventListener('beforeunload', handleUnload)

    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  if (
    isRedirectedPaymentError ||
    isErrorAddingSeats ||
    isErrorSendingMailToSales
  ) {
    return (
      <RequestStatus
        variant="danger"
        icon="error"
        title={t('something_went_wrong')}
        content={
          <Trans
            i18nKey="it_looks_like_that_didnt_work_you_can_try_again_or_get_in_touch"
            // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
            components={[<a href="/contact" rel="noreferrer noopener" />]}
          />
        }
      />
    )
  }

  if (isSuccessAddingSeats) {
    return (
      <RequestStatus
        variant="primary"
        icon="check_circle"
        title={t('youve_added_more_licenses')}
        content={
          <Trans
            i18nKey="youve_added_x_more_licenses_to_your_subscription_invite_people"
            components={[
              // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
              <a
                href={`/manage/groups/${subscriptionId}/members`}
                rel="noreferrer noopener"
              />,
            ]}
            values={{ users: addedSeatsData?.adding }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        }
      />
    )
  }

  if (isSuccessSendingMailToSales) {
    return (
      <RequestStatus
        icon="email"
        title={t('we_got_your_request')}
        content={t('our_team_will_get_back_to_you_shortly')}
      />
    )
  }

  return (
    <div className="container">
      <Row>
        <Col xxl={5} xl={6} lg={7} md={9} className="mx-auto">
          <div className="group-heading" data-testid="group-heading">
            <IconButton
              variant="ghost"
              href="/user/subscription"
              size="lg"
              icon="arrow_back"
              accessibilityLabel={t('back_to_subscription')}
            />
            <h2>{groupName || t('group_subscription')}</h2>
          </div>
          <Card className="card-description-secondary">
            <Card.Body>
              <form
                noValidate
                className="d-grid gap-4"
                onSubmit={handleSubmit}
                ref={formRef}
                data-testid="add-more-users-group-form"
              >
                <div className="d-grid gap-1">
                  <h4 className="fw-bold m-0 card-description-secondary">
                    {t('buy_more_licenses')}
                  </h4>
                  <div>
                    {t('your_current_plan_supports_up_to_x_licenses', {
                      users: totalLicenses,
                    })}
                  </div>
                  <div>
                    <Trans
                      i18nKey="if_you_want_to_reduce_the_number_of_licenses_please_contact_support"
                      components={[
                        // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                        <a
                          href="/contact"
                          onClick={() => {
                            sendMB('flex-add-users-form', {
                              action: 'click-contact-customer-support-link',
                            })
                          }}
                        />,
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <FormGroup controlId="number-of-users-input">
                    <FormLabel>
                      {t('how_many_licenses_do_you_want_to_buy')}
                    </FormLabel>
                    <FormControl
                      type="text"
                      required
                      className="w-25"
                      name="seats"
                      onChange={handleSeatsChange}
                      isInvalid={Boolean(addSeatsInputError)}
                    />
                    {Boolean(addSeatsInputError) && (
                      <FormText type="error">{addSeatsInputError}</FormText>
                    )}
                  </FormGroup>
                  {isCollectionMethodManual && (
                    <PoNumber
                      error={poNumberInputError}
                      validate={validatePoNumber}
                    />
                  )}
                </div>
                <CostSummarySection
                  isLoadingCostSummary={isLoadingCostSummary}
                  isErrorCostSummary={isErrorCostSummary}
                  errorCostSummary={errorCostSummary}
                  shouldContactSales={shouldContactSales}
                  costSummaryData={costSummaryData}
                  totalLicenses={totalLicenses}
                />
                <div className="d-flex align-items-center justify-content-end gap-2">
                  {!isProfessional && (
                    <a
                      href="/user/subscription/group/upgrade-subscription"
                      rel="noreferrer noopener"
                      className="me-auto"
                      onClick={() => {
                        sendMB('flex-upgrade')
                      }}
                    >
                      {t('upgrade_my_plan')}
                    </a>
                  )}
                  <Button
                    variant="secondary"
                    href="/user/subscription"
                    onClick={() =>
                      sendMB('flex-add-users-form', {
                        action: 'click-cancel-button',
                      })
                    }
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={
                      isAddingSeats ||
                      isLoadingCostSummary ||
                      isSendingMailToSales
                    }
                    isLoading={isAddingSeats || isSendingMailToSales}
                  >
                    {shouldContactSales ? t('send_request') : t('buy_licenses')}
                  </Button>
                </div>
              </form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

type CostSummarySectionProps = {
  isLoadingCostSummary: boolean
  isErrorCostSummary: boolean
  errorCostSummary: Nullable<FetchError>
  shouldContactSales: boolean
  costSummaryData: Nullable<CostSummaryData>
  totalLicenses: number
}

function CostSummarySection({
  isLoadingCostSummary,
  isErrorCostSummary,
  errorCostSummary,
  shouldContactSales,
  costSummaryData,
  totalLicenses,
}: CostSummarySectionProps) {
  const { t } = useTranslation()

  if (isLoadingCostSummary) {
    return <LoadingSpinner className="ms-auto me-auto" />
  }

  if (shouldContactSales) {
    return (
      <Notification
        content={
          <Trans
            i18nKey="if_you_want_more_than_x_licenses_on_your_plan_we_need_to_add_them_for_you"
            // eslint-disable-next-line react/jsx-key
            components={[<b />]}
            values={{ count: MAX_NUMBER_OF_USERS }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
          />
        }
        type="info"
      />
    )
  }

  if (isErrorCostSummary) {
    if (errorCostSummary?.data?.code === 'subtotal_limit_exceeded') {
      return (
        <Notification
          type="error"
          content={
            <Trans
              i18nKey="sorry_there_was_an_issue_adding_x_users_to_your_subscription"
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              components={[<a href="/contact" rel="noreferrer noopener" />]}
              values={{ count: errorCostSummary?.data?.adding }}
              shouldUnescape
              tOptions={{ interpolation: { escapeValue: true } }}
            />
          }
        />
      )
    }

    return (
      <Notification type="error" content={t('generic_something_went_wrong')} />
    )
  }

  return (
    <CostSummary
      subscriptionChange={costSummaryData}
      totalLicenses={totalLicenses}
    />
  )
}

export default withErrorBoundary(AddSeats)
