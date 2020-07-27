import { Application } from 'https://deno.land/x/oak/mod.ts'
import { oakCors } from 'https://deno.land/x/cors/mod.ts'
import quizRouter from './routes/quiz.ts'
import authRouter from './routes/auth.ts'
// import protectedRouter from './routes/protected.ts'
import notFound from './404.ts'
import { config } from 'https://deno.land/x/dotenv/mod.ts'
const env = config()
// import authMiddleware from './middleware/auth.ts'

const app = new Application()
const HOST = env.APP_HOST || 'http://localhost'
const PORT = +env.APP_PORT || 4000

app.use(oakCors())
app.use(authRouter.routes())
app.use(quizRouter.routes())
// app.use(protectedRouter.routes());
app.use(notFound)

console.log(`server is started at ${HOST}:${PORT}`)
await app.listen({ port: PORT })
