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
    const { value } = await reqBody
    const { email, password } = await value
    try {
        const user: any = await User.findOne({ email: email })
        if (!user) {
            response.status = 422
            response.body = {
                message: 'Neispravan email ili šifra',
            }
            return
        }
        const comparationResult = await hash.verify(user.password, password)
        if (!comparationResult) {
            response.status = 422
            response.body = {
                message: 'Neispravan email ili šifra',
            }
            return
        }

        const generatedToken = await token.generate(user)
        console.log(generatedToken, 'token')
        response.status = 200
        response.body = {
            success: 'Prijava uspješna!',
            token: generatedToken,
            userId: user._id.$oid,
        }
    } catch (error) {
        response.status = 500
        response.body = {
            error,
        }
    }
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
    const { value } = await reqBody
    const { email, password, fullName, isAdmin: myKey } = await value
    let isAdmin = false
    if (myKey === `${adminKey}`) {
        isAdmin = true
    }
    const hashedPw = await hash.bcrypt(password)
    try {
        const dbUser = await User.findOne({ email: email })
        if (dbUser) {
            response.status = 403
            response.body = {
                error: 'Uneta email adresa je zauzeta.',
            }
            return
        }
        const user: any = await User.insertOne({
            email,
            password: hashedPw,
            fullName,
            isAdmin,
        })
        console.log(user)
        response.status = 201
        response.body = {
            message: 'Registracija uspješna!',
            user: user.$oid,
        }
    } catch (error) {
        response.status = 500
        response.body = {
            error,
        }
    }
}
