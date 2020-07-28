import { hash, compare } from 'https://deno.land/x/bcrypt@v0.2.3/mod.ts'

export default {
    bcrypt: async (stringToHash: string): Promise<any> => {
        const hashedPw = await hash(stringToHash)
        return hashedPw
    },
    verify: async (hashedPw: string, text: string): Promise<boolean> => {
        const result = await compare(text, hashedPw)
        return result
    },
}
