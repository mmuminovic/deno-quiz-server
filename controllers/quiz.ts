import validation from '../validation.ts'
import db from '../config/databases.ts'
import shuffle from '../util/shuffle.ts'
const Question = db.collection('questions')
const Quiz = db.collection('quizzes')

export const createQuizQuestions = async ({ request, response }: any) => {
    const reqBody = await request.body()
    const { value } = reqBody
    const { userId } = value
    try {
        const result = await Question.find()
        let allQuestions = []
        let pitanja1: any[] = [],
            pitanja2: any[] = [],
            pitanja3: any[] = []
        result.forEach((item: any) => {
            if (item.points === 10) {
                pitanja1.push(item)
            } else if (item.points === 15) {
                pitanja2.push(item)
            } else if (item.points === 20) {
                pitanja3.push(item)
            }
        })

        allQuestions = [
            ...shuffle(pitanja1).slice(0, 20),
            ...shuffle(pitanja2).slice(0, 20),
            ...shuffle(pitanja3).slice(0, 20),
        ]

        let questionIds = allQuestions.map((q) => {
            const data = { question: q._id }
            return data
        })

        let answers = [
            allQuestions[0].correct,
            allQuestions[0].answer1,
            allQuestions[0].answer2,
            allQuestions[0].answer3,
        ]
        answers = shuffle(answers)

        const newQuiz = await Quiz.insertOne({
            takenBy: userId,
            questions: [...questionIds],
        })

        response.body = {
            quiz: newQuiz,
            firstQuestion: {
                id: allQuestions[0]._id,
                text: allQuestions[0].text,
                answer0: answers[0],
                answer1: answers[1],
                answer2: answers[2],
                answer3: answers[3],
                points: allQuestions[0].points,
            },
        }

        return response
    } catch (error) {
        response.body.message = error
        return response
    }
}

export const startQuiz = async ({
    request,
    response,
    params,
}: {
    request: any
    response: any
    params: { quizId: string }
}) => {
    const reqBody = await request.body()
    // const reqParams = await request.params();
    const { value: values } = reqBody

    const { quizId } = params
    const { userId, answer: ans } = values
    const continuing = values.continuing ? values.continuing : false

    const quiz: any = await Quiz.aggregate([
        {
            $match: {
                _id: quizId,
                createdAt: { $gt: new Date(Date.now() - 30 * 60 * 1000) },
            },
        },
        {
            $project: {
                createdAt: 1,
                updatedAt: 1,
                questions: 1,
                takenBy: 1,
                score: 1,
                active: 1,
            },
        },
        {
            $lookup: {
                from: 'questions',
                localField: '_id.questions.question',
                foreignField: '_id',
                as: 'question',
            },
        },
    ])

    if (!quiz) {
        response.statusCode = 403
        response.body = {
            message:
                'Predviđeno vrijeme za igranje kviza je isteklo. Ostvareni rezultat biće sačuvan. Počnite ponovo.',
        }
        return
    } else if (!quiz.active) {
        response.statusCode = 403
        response.body = {
            message: 'Kviz je završen. Počnite ponovo.',
        }
        return
    } else if (quiz.active && continuing) {
        const q = quiz.questions.find(
            (question: any) =>
                !question.isAnswered && !question.isAnsweredCorrectly
        )
        const mappedQuestions = quiz.questions.map((q: any) => q.question._id)
        const ordinalNumberOfQuestion =
            mappedQuestions.indexOf(q.question._id) + 1
        let answers = [
            q.question.correct,
            q.question.answer1,
            q.question.answer2,
            q.question.answer3,
        ]
        answers = shuffle(answers)

        response.body = {
            timeRemaining: Math.floor(
                (quiz.createdAt -
                    Number(new Date(Date.now() - 30 * 60 * 1000))) /
                    1000
            ),
            question: {
                id: q.question._id,
                text: q.question.text,
                answer0: answers[0],
                answer1: answers[1],
                answer2: answers[2],
                answer3: answers[3],
                points: q.question.points,
                num: ordinalNumberOfQuestion,
            },
            score: quiz.score,
        }
    } else {
        let questions = quiz.questions.filter(
            (question: any) => question.isAnswered === false
        )

        let correct = ans === questions[0].question.correct

        quiz.score = correct
            ? quiz.score + questions[0].question.points
            : quiz.score
        quiz.questions[
            quiz.questions.indexOf(questions[0])
        ].isAnsweredCorrectly = correct
        quiz.questions[quiz.questions.indexOf(questions[0])].isAnswered = true

        const question: any = await Question.findOne({
            _id: questions[0].question,
        })
        if (correct) {
            question.answeredCorrectly = question.answeredCorrectly + 1
        } else {
            question.answeredIncorrectly = question.answeredIncorrectly + 1
        }
        Question.updateOne(
            { _id: question._id },
            {
                $set: {
                    answeredCorrectly: question.answeredCorrectly,
                    answeredIncorrectly: question.answeredIncorrectly,
                },
            }
        )

        const updatedQuiz = await Quiz.updateOne(
            { _id: quiz._id },
            { $set: quiz }
        )

        if (questions[1]) {
            let answers = [
                questions[1].question.correct,
                questions[1].question.answer1,
                questions[1].question.answer2,
                questions[1].question.answer3,
            ]
            answers = shuffle(answers)
            response.body = {
                question: {
                    id: questions[1].question._id,
                    text: questions[1].question.text,
                    answer0: answers[0],
                    answer1: answers[1],
                    answer2: answers[2],
                    answer3: answers[3],
                    points: questions[1].question.points,
                },
                previousQuestion: {
                    correctAnswer: questions[0].question.correct,
                    link: questions[0].question.link,
                },
                score: quiz.score,
                incorrect: !correct,
                gameover: false,
            }
        } else {
            quiz.active = false
            const updatedQuiz = await Quiz.updateOne(
                { _id: quiz._id },
                { $set: quiz }
            )
            response.body = {
                message: 'Stigli ste do kraja kviza. Čestitamo!',
                finished: true,
                gameover: true,
                score: quiz.score,
                incorrect: !correct,
                previousQuestion: {
                    correctAnswer: questions[0].question.correct,
                    link: questions[0].question.link,
                },
            }
        }
    }
}

export const getMyScore = async ({
    request,
    response,
    params,
}: {
    request: any
    response: any
    params: { userId: string }
}) => {
    const { userId } = params
    const date = new Date()
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    try {
        const result = await Quiz.aggregate([
            {
                $match: {
                    takenBy: userId,
                    score: { $gt: 0 },
                    updatedAt: { $gt: firstDay, $lt: lastDay },
                },
            },
            {
                $sort: { score: -1, updatedAt: -1 },
            },
            {
                $project: {
                    createdAt: 1,
                    updatedAt: 1,
                    score: 1,
                    takenBy: 1,
                    duration: { $subtract: ['$updatedAt', '$createdAt'] },
                },
            },
            // {
            //     $group: { _id: { takenBy: "$takenBy" }, score: { $max: "$score" }, duration: { $min: "$duration" } }
            // },
            // {
            //     $lookup: { from: 'users', localField: '_id.takenBy', foreignField: '_id', as: 'user' }
            // },
            {
                $sort: { score: -1, duration: 1 },
            },
        ])

        const ranking = result.map((obj: any, i: number) => {
            let minutes = Math.floor(obj.duration / 60000)
            let seconds = ((obj.duration % 60000) / 1000).toFixed(0)
            if (seconds.length === 1) {
                seconds = `0${seconds}`
            }
            const data = {
                score: obj.score,
                duration: `${minutes}:${seconds}`,
            }
            return data
        })

        // The best scores
        const bestScores = await Quiz.aggregate([
            {
                $match: { takenBy: userId, score: { $gt: 0 } },
            },
            {
                $sort: { score: -1, updatedAt: -1 },
            },
            {
                $project: {
                    createdAt: 1,
                    updatedAt: 1,
                    score: 1,
                    takenBy: 1,
                    duration: { $subtract: ['$updatedAt', '$createdAt'] },
                },
            },
            // {
            //     $group: { _id: { takenBy: "$takenBy" }, score: { $max: "$score" }, duration: { $min: "$duration" } }
            // },
            // {
            //     $lookup: { from: 'users', localField: '_id.takenBy', foreignField: '_id', as: 'user' }
            // },
            {
                $sort: { score: -1, duration: 1 },
            },
        ])

        const topRecords = bestScores.map((obj: any, i: number) => {
            let minutes = Math.floor(obj.duration / 60000)
            let seconds = ((obj.duration % 60000) / 1000).toFixed(0)
            if (seconds.length === 1) {
                seconds = `0${seconds}`
            }
            const data = {
                score: obj.score,
                duration: `${minutes}:${seconds}`,
            }
            return data
        })

        // Last month score
        const firstDayOfLastMonth = new Date(
            date.getFullYear(),
            date.getMonth() - 1,
            1
        )
        const lastDayOfLastMonth = new Date(
            date.getFullYear(),
            date.getMonth(),
            0
        )

        const lastMonthScores = await Quiz.aggregate([
            {
                $match: {
                    takenBy: userId,
                    score: { $gt: 0 },
                    updatedAt: {
                        $gt: firstDayOfLastMonth,
                        $lt: lastDayOfLastMonth,
                    },
                },
            },
            {
                $sort: { score: -1, updatedAt: -1 },
            },
            {
                $project: {
                    createdAt: 1,
                    updatedAt: 1,
                    score: 1,
                    takenBy: 1,
                    duration: { $subtract: ['$updatedAt', '$createdAt'] },
                },
            },
            // {
            //     $group: { _id: { takenBy: "$takenBy" }, score: { $max: "$score" }, duration: { $min: "$duration" } }
            // },
            // {
            //     $lookup: { from: 'users', localField: '_id.takenBy', foreignField: '_id', as: 'user' }
            // },
            {
                $sort: { score: -1, duration: 1 },
            },
        ])

        let rankingLastMonth
        if (lastMonthScores.length !== 0) {
            rankingLastMonth = lastMonthScores.map((obj: any, i: number) => {
                let minutes = Math.floor(obj.duration / 60000)
                let seconds = ((obj.duration % 60000) / 1000).toFixed(0)
                if (seconds.length === 1) {
                    seconds = `0${seconds}`
                }
                const data = {
                    score: obj.score,
                    duration: `${minutes}:${seconds}`,
                }
                return data
            })
        } else {
            rankingLastMonth = [
                {
                    score: 0,
                    duration: `0:00`,
                },
            ]
        }

        response.body = {
            score: ranking[0],
            theBestScore: topRecords[0],
            scoreLastMonth: rankingLastMonth[0],
        }
        return response
    } catch (error) {
        console.log(error)
        response.statusCode = 500
        response.body = {
            message: error,
        }
        throw response
    }
}

// // RANKING LIST
export const getRankingList = async ({ response }: any) => {
    const date = new Date()
    let firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
    let lastDay = new Date(date.getFullYear(), date.getMonth(), 15)
    if (Date.now() > lastDay.getDate()) {
        firstDay = new Date(date.getFullYear(), date.getMonth(), 15)
        lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 1)
    }
    const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
    ]
    const [year1, year2] = [firstDay.getFullYear(), lastDay.getFullYear()]
    const [month1, month2] = [
        months[firstDay.getMonth()],
        months[lastDay.getMonth()],
    ]
    const [day1, day2] = [firstDay.getDate(), lastDay.getDate()]
    const time1 = day1 + ' ' + month1 + ' ' + year1
    const time2 = day2 + ' ' + month2 + ' ' + year2

    const rankingListTitle = `${time1} - ${time2}`

    const result = await Quiz.aggregate([
        {
            $match: {
                score: { $gt: 0 },
                updatedAt: { $gte: firstDay, $lt: lastDay },
            },
        },
        {
            $project: {
                createdAt: 1,
                updatedAt: 1,
                score: 1,
                takenBy: 1,
                duration: { $subtract: ['$updatedAt', '$createdAt'] },
            },
        },
        {
            $sort: { score: -1, duration: 1 },
        },
        {
            $group: {
                _id: { takenBy: '$takenBy' },
                score: { $max: '$score' },
                duration: { $first: '$duration' },
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id.takenBy',
                foreignField: '_id',
                as: 'user',
            },
        },
        {
            $sort: { score: -1, duration: 1 },
        },
    ])

    let rankingList: any[] = []
    result.forEach((obj: any, i: number) => {
        if (!obj.user[0].isWinner) {
            let minutes = Math.floor(obj.duration / 60000)
            let seconds = ((obj.duration % 60000) / 1000).toFixed(0)
            if (seconds.length === 1) {
                seconds = `0${seconds}`
            }
            const data = {
                userId: obj.user[0]._id,
                fullName: obj.user[0].fullName,
                score: obj.score,
                duration: `${minutes}:${seconds}`,
            }
            rankingList.push(data)
        }
    })

    // Ranking list of last month
    let rankingLastMonth
    try {
        const date = new Date()
        let firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
        let lastDay = new Date(date.getFullYear(), date.getMonth(), 15)
        if (Date.now() < lastDay.getDate()) {
            firstDay = new Date(date.getFullYear(), date.getMonth() - 1, 15)
            lastDay = new Date(date.getFullYear(), date.getMonth(), 1)
        }

        const [year1, year2] = [firstDay.getFullYear(), lastDay.getFullYear()]
        const [month1, month2] = [
            months[firstDay.getMonth()],
            months[lastDay.getMonth()],
        ]
        const [day1, day2] = [firstDay.getDate(), lastDay.getDate()]
        const time1 = day1 + ' ' + month1 + ' ' + year1
        const time2 = day2 + ' ' + month2 + ' ' + year2

        const rankingListTitle = `${time1} - ${time2}`

        const result = await Quiz.aggregate([
            {
                $match: {
                    score: { $gt: 0 },
                    updatedAt: { $gt: firstDay, $lt: lastDay },
                },
            },
            {
                $project: {
                    createdAt: 1,
                    updatedAt: 1,
                    score: 1,
                    takenBy: 1,
                    duration: { $subtract: ['$updatedAt', '$createdAt'] },
                },
            },
            {
                $sort: { score: -1, duration: 1 },
            },
            {
                $group: {
                    _id: { takenBy: '$takenBy' },
                    score: { $max: '$score' },
                    duration: { $first: '$duration' },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id.takenBy',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $sort: { score: -1, duration: 1 },
            },
        ])

        const numDaysBetween = (d1: any, d2: any) => {
            var diff = Math.abs(d1.getTime() - d2.getTime())
            return diff / (1000 * 60 * 60 * 24)
        }
        let rankingList: any[] = []
        result.forEach((obj: any, i: number) => {
            let minutes, seconds, data
            if (obj.user[0].isWinner) {
                if (numDaysBetween(obj.user[0].updatedAt, lastDay) < 5) {
                    minutes = Math.floor(obj.duration / 60000)
                    seconds = ((obj.duration % 60000) / 1000).toFixed(0)
                    if (seconds.length === 1) {
                        seconds = `0${seconds}`
                    }
                    data = {
                        userId: obj.user[0]._id,
                        fullName: obj.user[0].fullName,
                        score: obj.score,
                        duration: `${minutes}:${seconds}`,
                    }
                    rankingList.push(data)
                }
            } else {
                minutes = Math.floor(obj.duration / 60000)
                seconds = ((obj.duration % 60000) / 1000).toFixed(0)
                if (seconds.length === 1) {
                    seconds = `0${seconds}`
                }
                data = {
                    userId: obj.user[0]._id,
                    fullName: obj.user[0].fullName,
                    score: obj.score,
                    duration: `${minutes}:${seconds}`,
                }
                rankingList.push(data)
            }
        })

        rankingLastMonth = {
            rankingList: rankingList.slice(0, 10),
            rankingListTitle: rankingListTitle,
        }
    } catch (error) {
        console.log(error)
        response.statusCode = 500
        response.body = {
            message: error,
        }
        throw response
    }

    let top10ranking
    try {
        const result = await Quiz.aggregate([
            {
                $match: { score: { $gt: 0 } },
            },
            {
                $project: {
                    createdAt: 1,
                    updatedAt: 1,
                    score: 1,
                    takenBy: 1,
                    duration: { $subtract: ['$updatedAt', '$createdAt'] },
                },
            },
            {
                $sort: { score: -1, duration: 1 },
            },
            {
                $group: {
                    _id: { takenBy: '$takenBy' },
                    score: { $max: '$score' },
                    duration: { $first: '$duration' },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id.takenBy',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $sort: { score: -1, duration: 1 },
            },
        ])

        const ranking = result.map((obj: any, i: number) => {
            let minutes = Math.floor(obj.duration / 60000)
            let seconds: number | string = (obj.duration % 60000) / 1000
            if (seconds.toFixed(0).length === 1) {
                seconds = `0${seconds}`
            }
            const data = {
                userId: obj.user[0]._id,
                fullName: obj.user[0].fullName,
                score: obj.score,
                duration: `${minutes}:${seconds}`,
            }
            return data
        })
        top10ranking = ranking.slice(0, 10)
    } catch (error) {
        console.log(error)
        response.statusCode = 500
        response.body = {
            message: error,
        }
        throw response
    }

    // Today
    let theBestToday
    try {
        const today = new Date()
        today.setHours(0)
        today.setMinutes(0)
        today.setSeconds(0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0)
        tomorrow.setMinutes(0)
        tomorrow.setSeconds(0)

        const result = await Quiz.aggregate([
            {
                $match: {
                    score: { $gt: 0 },
                    updatedAt: { $gte: today, $lt: tomorrow },
                },
            },
            {
                $project: {
                    createdAt: 1,
                    updatedAt: 1,
                    score: 1,
                    takenBy: 1,
                    duration: { $subtract: ['$updatedAt', '$createdAt'] },
                },
            },
            {
                $sort: { score: -1, duration: 1 },
            },
            {
                $group: {
                    _id: { takenBy: '$takenBy' },
                    score: { $max: '$score' },
                    duration: { $first: '$duration' },
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id.takenBy',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $sort: { score: -1, duration: 1 },
            },
        ])
        const ranking = result.map((obj: any, i: number) => {
            let minutes = Math.floor(obj.duration / 60000)
            let seconds = ((obj.duration % 60000) / 1000).toFixed(0)
            if (seconds.length === 1) {
                seconds = `0${seconds}`
            }
            const data = {
                fullName: obj.user[0].fullName,
                score: obj.score,
                duration: `${minutes}:${seconds}`,
            }
            return data
        })

        theBestToday = ranking[0]
    } catch (error) {
        console.log(error)
        response.statusCode = 500
        response.body = {
            message: error,
        }
        throw response
    }

    response.body = {
        currentRankingList: {
            rankingList: rankingList.slice(0, 20),
            rankingListTitle: rankingListTitle,
        },
        rankingLastMonth,
        top10ranking,
        theBestToday,
    }

    return response
}

// exports.getQuestionsByCondition = (req, res, next) => {
//   let { condition, sortBy } = req.body;
//   Question.find(condition)
//     .sort([[sortBy, -1]])
//     .then((result) => {
//       res.json(result);
//     });
// };

export const addQuestion = async ({ request, response }: any) => {
    // validation
    const value = await validation.questionValidation({ request, response })
    if (!value) {
        return
    }

    try {
        const newQuestion = await Question.insertOne({
            text: request.text,
            answer1: request.answer1,
            answer2: request.answer2,
            answer3: request.answer3,
            correct: request.correct,
            link: request.link,
            points: request.points,
        })

        response.status = 201
        response.body = newQuestion
    } catch (error) {
        response.status = 500
        response.body = {
            error,
        }
    }
}

export const editQustion = async ({
    request,
    response,
    params,
}: {
    request: any
    response: any
    params: { questionId: string }
}) => {
    const value = await validation.questionValidation({ request, response })
    if (!value) {
        return
    }
    const { questionId } = params
    Question.updateOne({ _id: questionId }, value)
        .then((result: any) => {
            response.status = 201
            response.body = result
        })
        .catch((error: any) => {
            response.status = 500
            response.body = {
                error,
            }
        })
}

export const deleteQuestion = async ({
    request,
    response,
    params,
}: {
    request: any
    response: any
    params: { questionId: string }
}) => {
    const { questionId } = params
    Question.deleteOne({ _id: questionId })
        .then((result: any) => {
            response.status = 201
            response.body = result
        })
        .catch((error: any) => {
            response.status = 500
            response.body = {
                error,
            }
        })
}

export const mostActiveUsers = async ({ request, response }: any) => {
    const page = request.url.searchParams.get('page')
    const limit = request.url.searchParams.get('limit')

    try {
        const games = await Quiz.aggregate([
            {
                $match: { score: { $gte: 0 } },
            },
            {
                $project: { _id: 1, takenBy: 1, score: 1 },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'takenBy',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $group: {
                    _id: {
                        userId: '$user._id',
                        fullName: '$user.fullName',
                        isWinner: '$user.isWinner',
                    },
                    score: { $sum: 1 },
                },
            },
            { $sort: { score: -1 } },
        ])

        let quizPlayed = 0
        const users = games.map((obj: any, i: number) => {
            quizPlayed = quizPlayed + obj.score
            const data = {
                userId: obj._id.userId[0],
                fullName: obj._id.fullName[0],
                isWinner: obj._id.isWinner[0],
                numOfGames: obj.score,
            }
            return data
        })

        response.body = {
            users: users.slice((page - 1) * limit, page * limit),
            quizPlayed,
        }
    } catch (error) {
        response.status = 500
        response.body = {
            error,
        }
    }
}

export const statistics = async ({ request, response }: any) => {
    let timeofgameactivity = new Date(Date.now() - 30 * 60 * 1000)
    const today = new Date()
    today.setHours(0)
    today.setMinutes(0)
    today.setSeconds(0)

    // Games
    try {
        const games = await Quiz.aggregate([
            {
                $match: { score: { $gte: 0 } },
            },
            {
                $project: { _id: 1, takenBy: 1, score: 1, updatedAt: 1 },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'takenBy',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $group: {
                    _id: {
                        userId: '$user._id',
                        fullName: '$user.fullName',
                    },
                    score: { $sum: 1 },
                    dates: {
                        $push: '$updatedAt',
                    },
                    playedInMonths: {
                        $push: {
                            month: { $month: '$updatedAt' },
                            year: { $year: '$updatedAt' },
                            day: { $dayOfMonth: '$updatedAt' },
                        },
                    },
                },
            },
            { $sort: { score: -1 } },
        ])

        let quizPlayed = 0,
            activeGames = 0,
            playedToday = 0,
            datesOfGames: string[] = [],
            monthsAndYears: any[] = []

        games.forEach((data: any) => {
            quizPlayed = quizPlayed + data.score
            datesOfGames = [...datesOfGames, ...data.dates]
            monthsAndYears = [...monthsAndYears, ...data.playedInMonths]
        })

        let statisticsPerYears: any = {}

        monthsAndYears.forEach((e) => {
            console.log(statisticsPerYears[e.year[e.month]])
            statisticsPerYears[e.year] = {
                ...statisticsPerYears[e.year],
                [e.month]:
                    statisticsPerYears[e.year[e.month]] > 0
                        ? statisticsPerYears[e.year[e.month]] + 1
                        : 1,
            }
        })

        // played today
        datesOfGames.forEach((e) => {
            if (new Date(e).getTime() > today.getTime()) {
                playedToday++
            }
            if (new Date(e).getTime() - timeofgameactivity.getTime() > 0) {
                activeGames++
            }
        })

        quizPlayed = quizPlayed + 49918 // Because I deleted 49918 quizzes from db

        // dateOfGames.forEach(e => {
        //     if()
        // })

        // Response
        response.body = {
            quizPlayed,
            activeGames,
            playedToday,
            statisticsPerYears,
        }
    } catch (error) {
        console.log({ ...error })
        response.status = 500
        response.body = error
    }
}

// const active = await Quiz.aggregate([
//     {
//         $match: { createdAt: { $gt: time }, active: true },
//     },
//     {
//         $project: { _id: 1, takenBy: 1, score: 1 },
//     },
//     {
//         $lookup: {
//             from: 'users',
//             localField: 'takenBy',
//             foreignField: '_id',
//             as: 'user',
//         },
//     },
//     {
//         $group: {
//             _id: { userId: '$user._id', fullName: '$user.fullName' },
//             score: { $sum: 1 },
//         },
//     },
//     { $sort: { score: -1 } },
// ])

// let activeGames = 0
// active.forEach((obj) => {
//     activeGames = activeGames + obj.score
// })

// const todayGames = await Quiz.aggregate([
//     {
//         $match: {
//             createdAt: { $gt: today },
//             updatedAt: { $lt: tomorrow },
//         },
//     },
//     {
//         $project: { _id: 1, takenBy: 1, score: 1 },
//     },
//     {
//         $lookup: {
//             from: 'users',
//             localField: 'takenBy',
//             foreignField: '_id',
//             as: 'user',
//         },
//     },
//     {
//         $group: {
//             _id: { userId: '$user._id', fullName: '$user.fullName' },
//             score: { $sum: 1 },
//         },
//     },
//     { $sort: { score: -1 } },
// ])

// let todayPlayed = 0
// todayGames.forEach((obj) => {
//     todayPlayed = todayPlayed + obj.score
// })
