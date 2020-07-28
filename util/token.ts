import {
    validateJwt,
    parseAndDecode,
    validateJwtObject,
} from 'https://deno.land/x/djwt/validate.ts'
import {
    makeJwt,
    setExpiration,
    Jose,
    Payload,
} from 'https://deno.land/x/djwt/create.ts'

import { config } from 'https://deno.land/x/dotenv/mod.ts'
const env = config()
const key = `${env.JWT_KEY}`

const header: Jose = {
    alg: 'HS256',
    typ: 'JWT',
}

export default {
    async generate(user: any) {
        const payload: Payload = {
            userid: user._id,
            isAdmin: user.isAdmin,
            exp: setExpiration(new Date().getTime() + 60000 * 60),
        }
        const jwt = await makeJwt({ header, payload, key })
        return jwt
    },
    async validate(token: string) {
        const isTokenValid = await validateJwt({
            jwt: token,
            key,
            algorithm: 'HS256',
        })
        return isTokenValid
    },
    fetchUserId(token: string) {
        return validateJwtObject(parseAndDecode(token)).payload
    },
}
