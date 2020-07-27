// // Get All Users
// export const allUsers = (req, res, next) => {
//     const condition = req.query
//     User.find()
//         .sort(condition)
//         .then((result) => {
//             const users = result.map((user) => {
//                 return { userId: user._id, fullName: user.fullName }
//             })
//             res.json(users)
//         })
// }

// export const getWinners = (req, res, next) => {
//     User.find({ isWinner: true })
//         .sort({ fullName: 1 })
//         .then((result) => {
//             const users = result.map((user) => {
//                 return { userId: user._id, fullName: user.fullName }
//             })
//             res.json(users)
//         })
// }

// // Edit user
// export const editUser = (req, res, next) => {
//     const errors = validationResult(req)
//     if (!errors.isEmpty()) {
//         const error = new Error('Validation failed.')
//         error.data = errors.array()
//         return res.json({ error: error.data[0].msg })
//     }

//     const { password } = req.body
//     const userId = req.params.userId
//     bcrypt.hash(password, 12).then((hashedPw) => {
//         User.findOne({ _id: userId }).then((user) => {
//             user.password = hashedPw
//             user.save().then((result) => {
//                 res.json({ message: 'Šifra uspešno promijenjena.' })
//             })
//         })
//     })
// }

// export const deleteUser = (req, res, next) => {
//     const userId = req.params.userId
//     User.deleteOne({ _id: userId }).then((result) => res.json(result))
// }

// // Get user's info
// export const getUserInfo = (req, res, next) => {
//     const userId = req.params.userId
//     User.findById(userId).then((user) => {
//         const userData = {
//             email: user.email,
//             fullName: user.fullName,
//             isWinner: user.isWinner,
//         }
//         Quiz.find({ takenBy: userId })
//             .sort({ updatedAt: -1 })
//             .populate({
//                 path: 'questions.question',
//                 model: 'Question',
//             })
//             .then((result) => {
//                 const quiz = result.map((obj) => {
//                     const a = new Date(obj.updatedAt)
//                     const months = [
//                         'Jan',
//                         'Feb',
//                         'Mar',
//                         'Apr',
//                         'May',
//                         'Jun',
//                         'Jul',
//                         'Aug',
//                         'Sep',
//                         'Oct',
//                         'Nov',
//                         'Dec',
//                     ]
//                     const year = a.getFullYear()
//                     const month = months[a.getMonth()]
//                     const date = a.getDate()
//                     let hour = a.getHours()
//                     if (hour.toString().length == 1) {
//                         hour = '0' + hour
//                     }
//                     let min = a.getMinutes()
//                     if (min.toString().length == 1) {
//                         min = '0' + min
//                     }
//                     let sec = a.getSeconds()
//                     if (sec.toString().length == 1) {
//                         sec = '0' + sec
//                     }
//                     const time =
//                         date +
//                         ' ' +
//                         month +
//                         ' ' +
//                         year +
//                         ' ' +
//                         hour +
//                         ':' +
//                         min +
//                         ':' +
//                         sec
//                     let selectedQuestion = {}
//                     let incorrect = false
//                     let wrongAnswer = obj.questions.find(
//                         (q) =>
//                             q.isAnswered && !q.isAnsweredCorrectly && q.question
//                     )
//                     if (wrongAnswer) {
//                         Object.assign(selectedQuestion, {
//                             questionText: wrongAnswer.question.text,
//                             questionLink: wrongAnswer.question.link,
//                         })
//                         incorrect = true
//                     }
//                     let timeIsUp
//                     if (
//                         (obj.createdAt -
//                             new Date(Date.now() - 10 * 60 * 1000)) /
//                             1000 >
//                             0 &&
//                         obj.active
//                     ) {
//                         timeIsUp = false
//                         Object.assign(selectedQuestion, {
//                             questionText:
//                                 'Ovaj kviz nije završen. Možete ga nastaviti pritiskom na dugme ispod.',
//                             questionLink: obj._id,
//                         })
//                     } else if (
//                         (obj.createdAt -
//                             new Date(Date.now() - 10 * 60 * 1000)) /
//                             1000 <=
//                             0 &&
//                         !incorrect
//                     ) {
//                         timeIsUp = true
//                         Object.assign(selectedQuestion, {
//                             questionText:
//                                 'Niste završili kviz. Predviđeno vrijeme za igranje kviza je isteklo.',
//                             questionLink: 'Time is up.',
//                         })
//                     } else {
//                         timeIsUp = true
//                     }

//                     Object.assign(selectedQuestion, {
//                         time: time,
//                         score: obj.score,
//                         incorrect: incorrect,
//                         timeIsUp: timeIsUp,
//                     })

//                     return selectedQuestion
//                 })

//                 res.json({
//                     user: userData,
//                     quiz: quiz,
//                     numOfGames: result.length,
//                 })
//             })
//     })
// }

// export const setWinner = async (req, res, next) => {
//     const userId = req.params.userId
//     const user = await User.findById(userId)
//     user.isWinner = !user.isWinner
//     user.save().then((result) => {
//         res.json(result)
//     })
// }
