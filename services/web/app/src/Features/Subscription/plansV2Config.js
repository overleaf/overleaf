const plansV2Features = require('./plansV2Features')

const config = {
  individual: {
    tableHead: {
      individual_free: {},
      individual_personal: {},
      individual_collaborator: {},
      individual_professional: {},
    },
    features: plansV2Features.individual,
    highlightedColumn: {
      index: 2,
      text: {
        monthly: 'MOST POPULAR',
        annual: 'MOST POPULAR',
      },
    },
    eventTrackingKey: 'plans-page-click',
    additionalEventSegmentation: { 'plan-page-layout-v2': 'new-plans-page' },
  },
  group: {
    tableHead: {
      group_collaborator: {},
      group_professional: {},
      group_organization: {},
    },
    features: plansV2Features.group,
    highlightedColumn: {
      index: 1,
      text: {
        annual: 'RECOMMENDED',
      },
    },
    eventTrackingKey: 'plans-page-click',
    additionalEventSegmentation: { 'plan-page-layout-v2': 'new-plans-page' },
  },
  student: {
    tableHead: {
      student_free: {},
      student_student: {
        showExtraContent: false,
      },
      student_university: {},
    },
    features: plansV2Features.student,
    highlightedColumn: {
      index: 1,
      text: {
        monthly: 'SAVE 20% ON ANNUAL PLAN',
        annual: 'SAVING 20%',
      },
    },
    eventTrackingKey: 'plans-page-click',
    additionalEventSegmentation: { 'plan-page-layout-v2': 'new-plans-page' },
  },
}

module.exports = config
