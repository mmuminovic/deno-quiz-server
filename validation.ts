import {
    validate,
    required,
    isEmail,
    lengthBetween,
    maxLength,
    isString,
    flattenMessages,
    match,
} from 'https://deno.land/x/validasaur/mod.ts'

export default {
    async questionValidation({ request, response }: any) {
        let errors = []
        let status
        const { value } = await request.body()

        const fields = Object.keys(value)
        for (let field of fields) {
            if (!value[field]) {
                status = 422 // unprocessable entity
                errors.push({ [field]: `${field} field is required` })
            }
        }

        if (!status) {
            for (let field of fields) {
                if (field !== 'correct' && value[field] === value['correct']) {
                    status = 422 // unprocessable entity
                    errors.push({
                        [field]: `${field} and correct answer must be different `,
                    })
                }
            }
        }

        if (status) {
            response.status = status
            response.body = { errors }
            return false
        }

        return value
    },
    async validateLogin({ request, response }: any) {
        const { value } = await request.body()
        const credentials = await value

        const [passes, errors] = await validate(credentials, {
            email: [required, isEmail, maxLength(250)],
            password: [required, isString, lengthBetween(6, 50)],
        })

        if (passes) {
            return true
        } else {
            response.status = 422
            response.body = {
                errors,
            }
            return false
        }
    },
    async validateSignUp({ request, response }: any) {
        const { value } = await request.body()
        const credentials = await value

        const [passes, errors] = await validate(credentials, {
            email: [required, isEmail, maxLength(250)],
            password: [required, isString, lengthBetween(6, 50)],
            confirmPassword: [
                required,
                isString,
                lengthBetween(6, 50),
                match(credentials.password),
            ],
            fullName: [required, isString, lengthBetween(2, 250)],
        })

        if (passes) {
            return true
        } else {
            response.status = 422
            response.body = {
                errors,
            }
            return false
        }
    },
}
