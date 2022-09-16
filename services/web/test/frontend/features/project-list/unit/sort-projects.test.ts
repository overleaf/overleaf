import { expect } from 'chai'
import {
  ownerNameComparator,
  defaultComparator,
} from '../../../../../frontend/js/features/project-list/util/sort-projects'
import { Project } from '../../../../../types/project/dashboard/api'

const now = new Date()
const dateAddDays = (days = 0) => {
  return new Date(new Date().setDate(now.getDate() + days)).toISOString()
}

describe('sort comparators', function () {
  describe('default comparator', function () {
    it('sorts by `name`', function () {
      const projectsData = [
        { name: '#2' },
        { name: '#1' },
        { name: '#3' },
      ] as Project[]

      const result = [...projectsData].sort((v1, v2) => {
        return defaultComparator(v1, v2, 'name')
      })

      expect(result[0]).to.include(projectsData[1])
      expect(result[1]).to.include(projectsData[0])
      expect(result[2]).to.include(projectsData[2])
    })

    it('sorts by `lastUpdated`', function () {
      const projectsData = [
        { lastUpdated: dateAddDays(0) },
        { lastUpdated: dateAddDays(2) },
        { lastUpdated: dateAddDays(1) },
      ] as Project[]

      const result = [...projectsData].sort((v1, v2) => {
        return defaultComparator(v1, v2, 'lastUpdated')
      })

      expect(result[0]).to.include(projectsData[0])
      expect(result[1]).to.include(projectsData[2])
      expect(result[2]).to.include(projectsData[1])
    })
  })

  describe('owner comparator', function () {
    const owner = {
      id: '62d6d0b4c5c5030a4d696c7a',
      email: 'picard@overleaf.com',
      firstName: 'Jean-Luc',
      lastName: 'Picard',
    }
    const projectsData = [
      {
        lastUpdated: dateAddDays(0),
        accessLevel: 'readOnly',
        source: 'invite',
        owner,
      },
      {
        lastUpdated: dateAddDays(2),
        accessLevel: 'owner',
        source: 'owner',
        owner,
      },
      {
        lastUpdated: dateAddDays(1),
        accessLevel: 'readWrite',
        source: 'invite',
        owner,
      },
      {
        lastUpdated: dateAddDays(3),
        accessLevel: 'owner',
        source: 'owner',
        owner,
      },
      {
        lastUpdated: dateAddDays(8),
        accessLevel: 'readAndWrite',
        source: 'token',
        owner,
      },
      {
        lastUpdated: dateAddDays(1),
        accessLevel: 'owner',
        source: 'owner',
        owner,
      },
      {
        lastUpdated: dateAddDays(4),
        source: 'token',
        accessLevel: 'readOnly',
      },
      {
        lastUpdated: dateAddDays(1),
        source: 'token',
        accessLevel: 'readAndWrite',
        owner,
      },
      {
        lastUpdated: dateAddDays(3),
        source: 'token',
        accessLevel: 'readOnly',
      },
      {
        lastUpdated: dateAddDays(1),
        source: 'token',
        accessLevel: 'readAndWrite',
        owner,
      },
    ] as Project[]

    it('sorts by owner name', function () {
      const result = [...projectsData].sort((v1, v2) => {
        return ownerNameComparator(v1, v2)
      })

      expect(result[0]).to.include(projectsData[8])
      expect(result[1]).to.include(projectsData[6])
      expect(result[2]).to.include(projectsData[9])
      expect(result[3]).to.include(projectsData[7])
      expect(result[4]).to.include(projectsData[4])
      expect(result[5]).to.include(projectsData[0])
      expect(result[6]).to.include(projectsData[2])
      expect(result[7]).to.include(projectsData[5])
      expect(result[8]).to.include(projectsData[1])
      expect(result[9]).to.include(projectsData[3])
    })
  })
})
