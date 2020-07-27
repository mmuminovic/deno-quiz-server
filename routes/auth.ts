import { Router } from 'https://deno.land/x/oak/mod.ts'
// import UserController from '../controllers/UserController.ts'
// import AuthController from '../controllers/AuthController.ts'
import { login, signup } from '../controllers/auth.ts'
const router = new Router()

router
    .post('/login', login)
    .post('/signup', signup)

export default router
