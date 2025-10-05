import type { Party, PartyStatus, ExpeditionRequest } from '../types/index.ts'
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

  updatePartyStatus(id: number, status: PartyStatus): void {
    const parties = this.getParties()
    const party = parties.find(p => p.id === id)
    if (party) {
      party.status = status
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parties))
    }
  }

  getPartiesByStatus(status: PartyStatus): Party[] {
    return this.getParties().filter(party => party.status === status)
  }

  updateDungeonSettings(id: number, dungeonId: number): void {
    const parties = this.getParties()
    const party = parties.find(p => p.id === id)
    if (party) {
      party.dungeonId = dungeonId
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parties))
    }
  }

  updateFloorTarget(id: number, targetFloor: number | null): void {
    const parties = this.getParties()
    const party = parties.find(p => p.id === id)
    if (party) {
      party.targetFloor = targetFloor
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parties))
    }
  }

  updateReturnPolicy(id: number, returnPolicy: ExpeditionRequest["returnPolicy"]): void {
    const parties = this.getParties()
    const party = parties.find(p => p.id === id)
    if (party) {
      party.returnPolicy = returnPolicy
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parties))
    }
  }

  private getDefaultParties(): Party[] {
    return [
      { id: 1, name: 'PT1', memberIds: [], status: 'idle' },
      { id: 2, name: 'PT2', memberIds: [], status: 'idle' },
      { id: 3, name: 'PT3', memberIds: [], status: 'idle' }
    ]
  }
}