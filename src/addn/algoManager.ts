import dotenv from 'dotenv'
import { Database } from '../db'
import { Post } from '../db/schema'

export class AlgoManager {
  
    public db: Database
    public periodicIntervalId: NodeJS.Timer
    
    public name: string = ""

    public _isReady: Boolean = false
  
    constructor(db: Database) {
      this.db = db
      this._isReady = false
    }

    public async _start() {
        dotenv.config()

        await this.periodicTask()
        if (!this.periodicIntervalId) {
            this.periodicIntervalId = setInterval(()=>{this.periodicTask()},15000)
        }
        
        await this.start()

        this._isReady = true
        return this._isReady
    }

    public async start() {
        return
    }

    public async ready(): Promise<Boolean> {
        if (this._isReady) return this._isReady
        else return await this._start()
    }
  
    public async periodicTask() {
      return
    }
 
    public filter(post:Post) {
      return false
    }
  }