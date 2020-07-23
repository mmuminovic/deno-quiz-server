import { Router } from 'https://deno.land/x/oak/mod.ts'
// import UserController from '../controllers/UserController.ts'
// import AuthController from '../controllers/AuthController.ts'
import { oakCors } from 'https://deno.land/x/cors/mod.ts'
import {
    startQuiz,
    createQuizQuestions,
    addQuestion,
} from '../controllers/QuizController.ts'
const router = new Router()

router
    .post('/create-quiz', createQuizQuestions)
    .post('/start/:quizId', startQuiz)
    .post('/question', addQuestion)
// .get('/user', UserController.index)
// .get('/user/:id', UserController.show)
// .post('/user', UserController.store)
// .patch('/user/:id', UserController.update)
// .delete('/user/:id', UserController.destroy)
// .post('/signup', UserController.signup)

// router.options('/login', oakCors()).post('/login', AuthController.login)

export default router
