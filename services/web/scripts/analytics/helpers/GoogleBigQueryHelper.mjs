import { BigQuery as GoogleBigQuery } from '@google-cloud/bigquery'

let dataset = null

function getDataset() {
  if (!dataset) {
    console.log(
      'Connecting to BigQuery dataset: ',
      process.env.BQ_PROJECT_ID,
      process.env.BQ_DATASET_V2
    )

    dataset = new GoogleBigQuery({
      projectId: process.env.BQ_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILE,
    }).dataset(process.env.BQ_DATASET_V2)
  }

  return dataset
}

async function query(query, params = {}) {
  const [job] = await getDataset().createQueryJob({ query, params })
  const [rows] = await job.getQueryResults()
  return rows
}

export default {
  query,
}
