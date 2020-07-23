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
}
