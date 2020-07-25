import { init, MongoClient } from 'https://deno.land/x/mongo@v0.6.0/mod.ts'
await init()
const client = new MongoClient()
client.connectWithUri('mongodb+srv://Muhamed:h4rYK1Y2eVTvxwqN@cluster0-nulcu.mongodb.net')
const db = client.database('quiz')
export default db
