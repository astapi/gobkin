import type { Goblin } from '../../shared/types'
import type { IGoblinRepository } from '../repositories'

export class GetGoblinListUseCase {
  private readonly goblinRepository: IGoblinRepository

  constructor(goblinRepository: IGoblinRepository) {
    this.goblinRepository = goblinRepository
  }

  public execute(): Goblin[] {
    return this.goblinRepository.getGoblins()
  }
}
