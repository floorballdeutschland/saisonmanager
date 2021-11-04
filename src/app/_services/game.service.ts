import { Injectable } from '@angular/core'
import { HttpClient , HttpParams} from '@angular/common/http'

import { environment } from '../../environments/environment'
import { Game } from '../_models'

@Injectable()
export class GameService {

  constructor(
      private http: HttpClient,
    ) {
  }

  public getGame(gameId: number) {
    const path = environment.apiURL + 'games/' + gameId + '.json'
    return this.http.get<Game>(path)
  }
}
