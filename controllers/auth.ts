import db from '../config/databases.ts'
import validation from '../validation.ts'
import hash from '../util/hash.ts'
import token from '../util/token.ts'
// env
import { config } from 'https://deno.land/x/dotenv/mod.ts'
const env = config()
const adminKey = env.ADMIN_KEY

const User = db.collection('users')

// Login
export const login = async ({ request, response }: any) => {
    const validationResult = await validation.validateLogin({
        request,
        response,
    })
    if (!validationResult) {
        return
    }
    const reqBody = await request.body()
    const { email, password } = reqBody.value
    User.findOne({ email: email })
        .then((user: any) => {
            if (!user) {
                response.status = 422
                response.body = {
                    message: 'Neispravan email ili šifra',
                }
                return
            }
            const comparationResult = hash.verify(password, user.password)
            if (!comparationResult) {
                response.status = 422
                response.body = {
                    message: 'Neispravan email ili šifra',
                }
                return
            }
            if (comparationResult) {
                const generatedToken = token.generate(user)
                response.status = 200
                response.body = {
                    success: 'Prijava uspešna!',
                    token: token,
                    userId: user._id.toString(),
                }
                return
            } else {
                response.status = 422
                response.body = {
                    message: 'Neispravan email ili šifra',
                }
                return
            }
        })
        .catch((error) => {
            response.status = 500
            response.body = {
                error,
            }
            return
        })
}

// Signup
export const signup = async ({ request, response }: any) => {
    const validationResult = await validation.validateSignUp({
        request,
        response,
    })
    if (!validationResult) {
        return
    }
    const reqBody = await request.body()
    const { email, password, fullName, isAdmin: myKey } = reqBody.value
    let isAdmin = false
    if (myKey === `${adminKey}`) {
        isAdmin = true
    }
    const hashedPw = hash.bcrypt(password)
    try {
        const user: any = await User.insertOne({
            email,
            password: hashedPw,
            fullName,
            isAdmin,
        })
        response.status = 201
        response.body = {
            message: 'Registracija uspješna!',
            user: user._id,
        }
    } catch (error) {}
}
