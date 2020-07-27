import db from '../config/databases.ts'
import shuffle from '../util/shuffle.ts'
const Quote = db.collection('quizzes')

export const getRandomQuote = ({ request, response }: any) => {
    const userId = request.url.searchParams.get('userId')

    Quote.find().then((quotes: any[]) => {
        if (quotes.length === 0) {
            let quote = {
                quoteId: null,
                quoteText: null,
                quoteAuthor: null,
                quoteSource: null,
                likes: 0,
                likedByMe: false,
            }
            response.body = { quote }
        } else {
            let shuffledQuotes = shuffle(quotes)
            let likes = shuffledQuotes[0].likedBy.length
            let likedByMe
            if (shuffledQuotes[0].likedBy.length === 0) {
                likedByMe = false
            } else if (
                shuffledQuotes[0].likedBy.some((e: any) => {
                    if (e.user) {
                        return e.user.toString() === userId
                    } else {
                        return false
                    }
                })
            ) {
                likedByMe = true
            } else {
                likedByMe = false
            }

            let quote = {
                quoteId: shuffledQuotes[0]._id,
                quoteText: shuffledQuotes[0].quoteText,
                quoteAuthor: shuffledQuotes[0].quoteAuthor,
                quoteSource: shuffledQuotes[0].quoteSource,
                likes: likes,
                likedByMe: likedByMe,
            }
            response.body = { quote }
        }
    })
}

export const likeQuote = async ({ request, response, params }: any) => {
    const reqBody = await request.body()
    const { value: body } = reqBody
    const { quoteId } = params
    const { userId } = body

    Quote.findOne({ _id: quoteId })
        .then((quote: any): any => {
            if (quote.likedBy.length === 0) {
                quote.likedBy.push({ user: userId })
                return Quote.updateOne(
                    { _id: quote._id },
                    { $set: { likedBy: quote.likedBy } }
                )
            } else if (
                quote.likedBy.some((e: any) => {
                    if (e.user) {
                        return e.user.toString() === userId
                    }
                })
            ) {
                return { message: 'Status je već lajkovan.' }
            } else {
                quote.likedBy.push({ user: userId })
                return Quote.updateOne(
                    { _id: quote._id },
                    { $set: { likedBy: quote.likedBy } }
                )
            }
        })
        .then((result) => {
            response.status = 201
            response.body = {
                ...result,
            }
        })
        .catch((error) => {
            response.status = 500
            response.body = { error }
        })
}
