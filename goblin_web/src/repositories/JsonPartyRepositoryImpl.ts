import type { Party } from '../types/index.ts'
import type { PartyRepository } from './PartyRepository.ts'

const STORAGE_KEY = 'goblin_kingdom_parties'

export class JsonPartyRepositoryImpl implements PartyRepository {
  getParties(): Party[] {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) {
      return this.getDefaultParties()
    }
    try {
      return JSON.parse(data)
    } catch {
      return this.getDefaultParties()
    }
  }

  getParty(id: number): Party | null {
    const parties = this.getParties()
    return parties.find(party => party.id === id) || null
  }

  saveParty(party: Party): void {
    const parties = this.getParties()
    const index = parties.findIndex(p => p.id === party.id)
    if (index >= 0) {
      parties[index] = party
    } else {
      parties.push(party)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parties))
  }

  deleteParty(id: number): void {
    const parties = this.getParties().filter(party => party.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parties))
  }

  private getDefaultParties(): Party[] {
    return [
      { id: 1, name: 'PT1', memberIds: [] },
      { id: 2, name: 'PT2', memberIds: [] },
      { id: 3, name: 'PT3', memberIds: [] }
    ]
  }
}