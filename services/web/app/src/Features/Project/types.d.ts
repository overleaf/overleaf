import express from 'express'
import {
  GetProjectsRequestBody,
  GetProjectsResponseBody,
} from '../../../../types/project/dashboard/api'

export type GetProjectsRequest = express.Request<
  unknown,
  unknown,
  GetProjectsRequestBody,
  unknown
>

export type GetProjectsResponse = express.Response<GetProjectsResponseBody>

export type MongoProject = {
  _id: string
  name: string
  lastUpdated: Date
  lastUpdatedBy: string
  publicAccesLevel: string
  archived: string[]
  trashed: boolean
  owner_ref: string
  tokens: {
    readOnly: string[]
    readAndWrite: string[]
    readAndWritePrefix: string[]
  }[]
}

export type AllUsersProjects = {
  owned: MongoProject[]
  readAndWrite: MongoProject[]
  readOnly: MongoProject[]
  tokenReadAndWrite: MongoProject[]
  tokenReadOnly: MongoProject[]
}
