const plansFeatures = require('./plansFeatures')

const config = {
  individual: {
    maxColumn: 3,
    tableHead: {
      individual_free: {},
      individual_collaborator: {},
      individual_professional: {},
    },
    features: plansFeatures.individual,
    highlightedColumn: {
      index: 1,
      text: {
        monthly: 'most_popular',
        annual: 'most_popular',
      },
    },
    eventTrackingKey: 'plans-page-click',
    additionalEventSegmentation: {},
  },
  group: {
    tableHead: {
      group_collaborator: {},
      group_professional: {},
      group_organization: {},
    },
    features: plansFeatures.group,
    highlightedColumn: {
      index: 0,
      text: {
        annual: 'most_popular',
      },
    },
    eventTrackingKey: 'plans-page-click',
    additionalEventSegmentation: {},
  },
  student: {
    baseColspan: 2,
    maxColumn: 3,
    tableHead: {
      student_free: {
        colspan: 3,
      },
      student_student: {
        showExtraContent: false,
        colspan: 3,
      },
    },
    features: plansFeatures.student,
    highlightedColumn: {
      index: 1,
      text: {
        monthly: 'save_20_percent_by_paying_annually',
        annual: 'saving_20_percent',
      },
    },
    eventTrackingKey: 'plans-page-click',
    additionalEventSegmentation: {},
  },
}

module.exports = config
