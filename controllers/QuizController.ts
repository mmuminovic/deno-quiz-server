import validation from "../validation.ts";
import db from "../config/databases.ts";
import shuffle from "../util/shuffle.ts";
import { ObjectId } from "https://deno.land/x/mongo@v0.6.0/mod.ts";
const Question = db.collection("questions");
const Quiz = db.collection("quizzes");

export const createQuizQuestions = async ({ request, response }: any) => {
  const reqBody = await request.body();
  const { value } = reqBody;
  const { userId } = value;
  try {
    const result = await Question.find();
    let allQuestions = [];
    let pitanja1 = [],
      pitanja2 = [],
      pitanja3 = [];
    for (let i of result) {
      if (i.points === 10) {
        pitanja1.push(i);
      } else if (i.points === 15) {
        pitanja2.push(i);
      } else if (i.points === 20) {
        pitanja3.push(i);
      }
    }
    pitanja1 = shuffle(pitanja1).slice(0, 20);
    pitanja2 = shuffle(pitanja2).slice(0, 20);
    pitanja3 = shuffle(pitanja3).slice(0, 20);
    allQuestions = [...pitanja1, ...pitanja2, ...pitanja3];

    let questionIds = allQuestions.map((q) => {
      const data = { question: q._id };
      return data;
    });

    let answers = [
      allQuestions[0].correct,
      allQuestions[0].answer1,
      allQuestions[0].answer2,
      allQuestions[0].answer3,
    ];
    answers = shuffle(answers);

    const newQuiz = await Quiz.insertOne({
      takenBy: userId,
      questions: [...questionIds],
    });

    response.body = {
      quiz: newQuiz._id,
      firstQuestion: {
        id: allQuestions[0]._id,
        text: allQuestions[0].text,
        answer0: answers[0],
        answer1: answers[1],
        answer2: answers[2],
        answer3: answers[3],
        points: allQuestions[0].points,
      },
    };

    return response;
  } catch (error) {
    response.body.message = error;
    return response;
  }
};

export const startQuiz = async ({ request, response, params }: any) => {
  const reqBody = await request.body();
  // const reqParams = await request.params();
  const { value: values } = reqBody;

  const { quizId } = params;
  const { userId, answer: ans } = values;
  const continuing = values.continuing ? values.continuing : false;

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
        from: "questions",
        localField: "_id.questions.question",
        foreignField: "_id",
        as: "question",
      },
    },
  ]);

  if (!quiz) {
    response.statusCode = 403;
    response.body = {
      message:
        "Predviđeno vrijeme za igranje kviza je isteklo. Ostvareni rezultat biće sačuvan. Počnite ponovo.",
    };
    return;
  } else if (!quiz.active) {
    response.statusCode = 403;
    response.body = {
      message: "Kviz je završen. Počnite ponovo.",
    };
    return;
  } else if (quiz.active && continuing) {
    const q = quiz.questions.find(
      (question: any) => !question.isAnswered && !question.isAnsweredCorrectly
    );
    const mappedQuestions = quiz.questions.map((q: any) => q.question._id);
    const ordinalNumberOfQuestion = mappedQuestions.indexOf(q.question._id) + 1;
    let answers = [
      q.question.correct,
      q.question.answer1,
      q.question.answer2,
      q.question.answer3,
    ];
    answers = shuffle(answers);

    response.body = {
      timeRemaining: Math.floor(
        (quiz.createdAt - Number(new Date(Date.now() - 30 * 60 * 1000))) / 1000
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
    };
  } else {
    let questions = quiz.questions.filter(
      (question: any) => question.isAnswered === false
    );

    let correct = ans === questions[0].question.correct;

    quiz.score = correct
      ? quiz.score + questions[0].question.points
      : quiz.score;
    quiz.questions[
      quiz.questions.indexOf(questions[0])
    ].isAnsweredCorrectly = correct;
    quiz.questions[quiz.questions.indexOf(questions[0])].isAnswered = true;

    const question = await Question.findOne({ _id: questions[0].question });
    if (correct) {
      question.answeredCorrectly = question.answeredCorrectly + 1;
    } else {
      question.answeredIncorrectly = question.answeredIncorrectly + 1;
    }
    Question.updateOne(
      { _id: question._id },
      {
        $set: {
          answeredCorrectly: question.answeredCorrectly,
          answeredIncorrectly: question.answeredIncorrectly,
        },
      }
    );

    const updatedQuiz = await Quiz.updateOne({ _id: quiz._id }, { $set: quiz });

    if (questions[1]) {
      let answers = [
        questions[1].question.correct,
        questions[1].question.answer1,
        questions[1].question.answer2,
        questions[1].question.answer3,
      ];
      answers = shuffle(answers);
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
      };
    } else {
      quiz.active = false;
      const updatedQuiz = await Quiz.updateOne(
        { _id: quiz._id },
        { $set: quiz }
      );
      response.body = {
        message: "Stigli ste do kraja kviza. Čestitamo!",
        finished: true,
        gameover: true,
        score: quiz.score,
        incorrect: !correct,
        previousQuestion: {
          correctAnswer: questions[0].question.correct,
          link: questions[0].question.link,
        },
      };
    }
  }
};

// exports.deleteUserGames = (req, res, next) => {
//   const userId = req.params.userId;
//   Quiz.deleteMany({ takenBy: userId }).then((result) => {
//     res.json({ message: "Delete successful" });
//   });
// };

// exports.getMyScore = (req, res, next) => {
//   const userId = mongoose.Types.ObjectId(req.params.userId);
//   const date = new Date();
//   const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
//   const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

//   Quiz.aggregate(
//     [
//       {
//         $match: {
//           takenBy: userId,
//           score: { $gt: 0 },
//           updatedAt: { $gt: firstDay, $lt: lastDay },
//         },
//       },
//       {
//         $sort: { score: -1, updatedAt: -1 },
//       },
//       {
//         $project: {
//           createdAt: 1,
//           updatedAt: 1,
//           score: 1,
//           takenBy: 1,
//           duration: { $subtract: ["$updatedAt", "$createdAt"] },
//         },
//       },
//       // {
//       //     $group: { _id: { takenBy: "$takenBy" }, score: { $max: "$score" }, duration: { $min: "$duration" } }
//       // },
//       // {
//       //     $lookup: { from: 'users', localField: '_id.takenBy', foreignField: '_id', as: 'user' }
//       // },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//     ],
//     (err, result) => {
//       const ranking = result.map((obj, i) => {
//         let minutes = Math.floor(obj.duration / 60000);
//         let seconds = ((obj.duration % 60000) / 1000).toFixed(0);
//         if (seconds.length === 1) {
//           seconds = `0${seconds}`;
//         }
//         const data = {
//           score: obj.score,
//           duration: `${minutes}:${seconds}`,
//         };
//         return data;
//       });
//       res.json(ranking[0]);
//     }
//   );
// };

// exports.getMyBestScore = (req, res, next) => {
//   const userId = mongoose.Types.ObjectId(req.params.userId);

//   Quiz.aggregate(
//     [
//       {
//         $match: { takenBy: userId, score: { $gt: 0 } },
//       },
//       {
//         $sort: { score: -1, updatedAt: -1 },
//       },
//       {
//         $project: {
//           createdAt: 1,
//           updatedAt: 1,
//           score: 1,
//           takenBy: 1,
//           duration: { $subtract: ["$updatedAt", "$createdAt"] },
//         },
//       },
//       // {
//       //     $group: { _id: { takenBy: "$takenBy" }, score: { $max: "$score" }, duration: { $min: "$duration" } }
//       // },
//       // {
//       //     $lookup: { from: 'users', localField: '_id.takenBy', foreignField: '_id', as: 'user' }
//       // },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//     ],
//     (err, result) => {
//       const ranking = result.map((obj, i) => {
//         let minutes = Math.floor(obj.duration / 60000);
//         let seconds = ((obj.duration % 60000) / 1000).toFixed(0);
//         if (seconds.length === 1) {
//           seconds = `0${seconds}`;
//         }
//         const data = {
//           score: obj.score,
//           duration: `${minutes}:${seconds}`,
//         };
//         return data;
//       });
//       res.json(ranking[0]);
//     }
//   );
// };

// exports.scoreLastMonth = (req, res, next) => {
//   const userId = mongoose.Types.ObjectId(req.params.userId);
//   const date = new Date();
//   const firstDay = new Date(date.getFullYear(), date.getMonth() - 1, 1);
//   const lastDay = new Date(date.getFullYear(), date.getMonth(), 0);

//   Quiz.aggregate(
//     [
//       {
//         $match: {
//           takenBy: userId,
//           score: { $gt: 0 },
//           updatedAt: { $gt: firstDay, $lt: lastDay },
//         },
//       },
//       {
//         $sort: { score: -1, updatedAt: -1 },
//       },
//       {
//         $project: {
//           createdAt: 1,
//           updatedAt: 1,
//           score: 1,
//           takenBy: 1,
//           duration: { $subtract: ["$updatedAt", "$createdAt"] },
//         },
//       },
//       // {
//       //     $group: { _id: { takenBy: "$takenBy" }, score: { $max: "$score" }, duration: { $min: "$duration" } }
//       // },
//       // {
//       //     $lookup: { from: 'users', localField: '_id.takenBy', foreignField: '_id', as: 'user' }
//       // },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//     ],
//     (err, result) => {
//       if (result.length !== 0) {
//         const ranking = result.map((obj, i) => {
//           let minutes = Math.floor(obj.duration / 60000);
//           let seconds = ((obj.duration % 60000) / 1000).toFixed(0);
//           if (seconds.length === 1) {
//             seconds = `0${seconds}`;
//           }
//           const data = {
//             score: obj.score,
//             duration: `${minutes}:${seconds}`,
//           };
//           return data;
//         });
//         res.json(ranking[0]);
//       } else {
//         res.json({
//           score: 0,
//           duration: `0:00`,
//         });
//       }
//     }
//   );
// };

// // RANKING LIST
// exports.getRankingList = (req, res, next) => {
//   const date = new Date();
//   let firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
//   let lastDay = new Date(date.getFullYear(), date.getMonth(), 15);
//   if (Date.now() > lastDay) {
//     firstDay = new Date(date.getFullYear(), date.getMonth(), 15);
//     lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 1);
//   }
//   const months = [
//     "Jan",
//     "Feb",
//     "Mar",
//     "Apr",
//     "May",
//     "Jun",
//     "Jul",
//     "Aug",
//     "Sep",
//     "Oct",
//     "Nov",
//     "Dec",
//   ];
//   const [year1, year2] = [firstDay.getFullYear(), lastDay.getFullYear()];
//   const [month1, month2] = [
//     months[firstDay.getMonth()],
//     months[lastDay.getMonth()],
//   ];
//   const [day1, day2] = [firstDay.getDate(), lastDay.getDate()];
//   const time1 = day1 + " " + month1 + " " + year1;
//   const time2 = day2 + " " + month2 + " " + year2;

//   const rankingListTitle = `${time1} - ${time2}`;

//   Quiz.aggregate(
//     [
//       {
//         $match: {
//           score: { $gt: 0 },
//           updatedAt: { $gte: firstDay, $lt: lastDay },
//         },
//       },
//       {
//         $project: {
//           createdAt: 1,
//           updatedAt: 1,
//           score: 1,
//           takenBy: 1,
//           duration: { $subtract: ["$updatedAt", "$createdAt"] },
//         },
//       },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//       {
//         $group: {
//           _id: { takenBy: "$takenBy" },
//           score: { $max: "$score" },
//           duration: { $first: "$duration" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id.takenBy",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//     ],
//     (err, result) => {
//       let rankingList = [];
//       result.forEach((obj) => {
//         if (!obj.user[0].isWinner) {
//           let minutes = Math.floor(obj.duration / 60000);
//           let seconds = ((obj.duration % 60000) / 1000).toFixed(0);
//           if (seconds.length === 1) {
//             seconds = `0${seconds}`;
//           }
//           const data = {
//             userId: obj.user[0]._id,
//             fullName: obj.user[0].fullName,
//             score: obj.score,
//             duration: `${minutes}:${seconds}`,
//           };
//           rankingList.push(data);
//         }
//       });
//       res.json({
//         rankingList: rankingList.slice(0, 20),
//         rankingListTitle: rankingListTitle,
//       });
//       // res.json(result);
//     }
//   );
// };

// exports.getBestPlayerToday = (req, res, next) => {
//   const today = new Date();
//   today.setHours(0);
//   today.setMinutes(0);
//   today.setSeconds(0);
//   const tomorrow = new Date(today);
//   tomorrow.setDate(tomorrow.getDate() + 1);
//   tomorrow.setHours(0);
//   tomorrow.setMinutes(0);
//   tomorrow.setSeconds(0);

//   Quiz.aggregate(
//     [
//       {
//         $match: {
//           score: { $gt: 0 },
//           updatedAt: { $gte: today, $lt: tomorrow },
//         },
//       },
//       {
//         $project: {
//           createdAt: 1,
//           updatedAt: 1,
//           score: 1,
//           takenBy: 1,
//           duration: { $subtract: ["$updatedAt", "$createdAt"] },
//         },
//       },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//       {
//         $group: {
//           _id: { takenBy: "$takenBy" },
//           score: { $max: "$score" },
//           duration: { $first: "$duration" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id.takenBy",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//     ],
//     (err, result) => {
//       const ranking = result.map((obj, i) => {
//         let minutes = Math.floor(obj.duration / 60000);
//         let seconds = ((obj.duration % 60000) / 1000).toFixed(0);
//         if (seconds.length === 1) {
//           seconds = `0${seconds}`;
//         }
//         const data = {
//           fullName: obj.user[0].fullName,
//           score: obj.score,
//           duration: `${minutes}:${seconds}`,
//         };
//         return data;
//       });
//       res.json(ranking[0]);
//     }
//   );
// };

// exports.getLastMonthList = (req, res, next) => {
//   const date = new Date();
//   let firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
//   let lastDay = new Date(date.getFullYear(), date.getMonth(), 15);
//   if (Date.now() < lastDay) {
//     firstDay = new Date(date.getFullYear(), date.getMonth() - 1, 15);
//     lastDay = new Date(date.getFullYear(), date.getMonth(), 1);
//   }
//   const months = [
//     "Jan",
//     "Feb",
//     "Mar",
//     "Apr",
//     "May",
//     "Jun",
//     "Jul",
//     "Aug",
//     "Sep",
//     "Oct",
//     "Nov",
//     "Dec",
//   ];
//   const [year1, year2] = [firstDay.getFullYear(), lastDay.getFullYear()];
//   const [month1, month2] = [
//     months[firstDay.getMonth()],
//     months[lastDay.getMonth()],
//   ];
//   const [day1, day2] = [firstDay.getDate(), lastDay.getDate()];
//   const time1 = day1 + " " + month1 + " " + year1;
//   const time2 = day2 + " " + month2 + " " + year2;

//   const rankingListTitle = `${time1} - ${time2}`;

//   Quiz.aggregate(
//     [
//       {
//         $match: {
//           score: { $gt: 0 },
//           updatedAt: { $gt: firstDay, $lt: lastDay },
//         },
//       },
//       {
//         $project: {
//           createdAt: 1,
//           updatedAt: 1,
//           score: 1,
//           takenBy: 1,
//           duration: { $subtract: ["$updatedAt", "$createdAt"] },
//         },
//       },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//       {
//         $group: {
//           _id: { takenBy: "$takenBy" },
//           score: { $max: "$score" },
//           duration: { $first: "$duration" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id.takenBy",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//     ],
//     (err, result) => {
//       const numDaysBetween = (d1, d2) => {
//         var diff = Math.abs(d1.getTime() - d2.getTime());
//         return diff / (1000 * 60 * 60 * 24);
//       };
//       let rankingList = [];
//       result.forEach((obj) => {
//         let minutes, seconds, data;
//         if (obj.user[0].isWinner) {
//           if (numDaysBetween(obj.user[0].updatedAt, lastDay) < 5) {
//             minutes = Math.floor(obj.duration / 60000);
//             seconds = ((obj.duration % 60000) / 1000).toFixed(0);
//             if (seconds.length === 1) {
//               seconds = `0${seconds}`;
//             }
//             data = {
//               userId: obj.user[0]._id,
//               fullName: obj.user[0].fullName,
//               score: obj.score,
//               duration: `${minutes}:${seconds}`,
//             };
//             rankingList.push(data);
//           }
//         } else {
//           minutes = Math.floor(obj.duration / 60000);
//           seconds = ((obj.duration % 60000) / 1000).toFixed(0);
//           if (seconds.length === 1) {
//             seconds = `0${seconds}`;
//           }
//           data = {
//             userId: obj.user[0]._id,
//             fullName: obj.user[0].fullName,
//             score: obj.score,
//             duration: `${minutes}:${seconds}`,
//           };
//           rankingList.push(data);
//         }
//       });

//       res.json({
//         rankingList: rankingList.slice(0, 10),
//         rankingListTitle: rankingListTitle,
//       });
//     }
//   );
// };

// exports.getTheBestRecords = (req, res, next) => {
//   Quiz.aggregate(
//     [
//       {
//         $match: { score: { $gt: 0 } },
//       },
//       {
//         $project: {
//           createdAt: 1,
//           updatedAt: 1,
//           score: 1,
//           takenBy: 1,
//           duration: { $subtract: ["$updatedAt", "$createdAt"] },
//         },
//       },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//       {
//         $group: {
//           _id: { takenBy: "$takenBy" },
//           score: { $max: "$score" },
//           duration: { $first: "$duration" },
//         },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "_id.takenBy",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $sort: { score: -1, duration: 1 },
//       },
//     ],
//     (err, result) => {
//       const ranking = result.map((obj, i) => {
//         let minutes = Math.floor(obj.duration / 60000);
//         let seconds = (obj.duration % 60000) / 1000;
//         if (seconds.toFixed(0).length === 1) {
//           seconds = `0${seconds}`;
//         }
//         const data = {
//           userId: obj.user[0]._id,
//           fullName: obj.user[0].fullName,
//           score: obj.score,
//           duration: `${minutes}:${seconds}`,
//         };
//         return data;
//       });
//       res.json(ranking.slice(0, 10));
//     }
//   );
// };

// exports.getQuestionsByCondition = (req, res, next) => {
//   let { condition, sortBy } = req.body;
//   Question.find(condition)
//     .sort([[sortBy, -1]])
//     .then((result) => {
//       res.json(result);
//     });
// };

// exports.addQuestion = (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     const error = new Error("Validation failed.");
//     error.statusCode = 500;
//     error.data = errors.array();
//     return res.json({ error: error.data[0].msg });
//   }
//   const newQuestion = new Question({
//     _id: new mongoose.Types.ObjectId(),
//     text: req.body.text,
//     answer1: req.body.answer1,
//     answer2: req.body.answer2,
//     answer3: req.body.answer3,
//     correct: req.body.correct,
//     link: req.body.link,
//     points: req.body.points,
//   });
//   newQuestion.save().then((result) => {
//     res.json(result);
//   });
// };

// exports.editQustion = (req, res, next) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     const error = new Error("Validation failed.");
//     error.statusCode = 500;
//     error.data = errors.array();
//     return res.json({ error: error.data[0].msg });
//   }
//   const questionId = req.params.questionId;
//   const newData = req.body;
//   Question.updateOne({ _id: questionId }, newData).then((result) =>
//     res.json(result)
//   );
// };

// exports.deleteQuestion = (req, res, next) => {
//   const questionId = req.params.questionId;
//   Question.deleteOne({ _id: questionId }).then((result) => res.json(result));
// };

// exports.theMostSuccessfulQuestions = (req, res, next) => {
//   Question.find()
//     .sort({ answeredCorrectly: -1 })
//     .where("answeredCorrectly")
//     .gt(0)
//     .limit(10)
//     .then((questions) => {
//       res.json(questions);
//     });
// };

// exports.theMostUnsuccessfulQuestions = (req, res, next) => {
//   Question.find()
//     .sort({ answeredIncorrectly: -1 })
//     .where("answeredIncorrectly")
//     .gt(0)
//     .limit(10)
//     .then((questions) => {
//       res.json(questions);
//     });
// };

// exports.getUserNumOfGames = (req, res, next) => {
//   Quiz.aggregate(
//     [
//       {
//         $match: { score: { $gte: 0 } },
//       },
//       {
//         $project: { _id: 1, takenBy: 1, score: 1 },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "takenBy",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $group: {
//           _id: {
//             userId: "$user._id",
//             fullName: "$user.fullName",
//             isWinner: "$user.isWinner",
//           },
//           score: { $sum: 1 },
//         },
//       },
//       { $sort: { score: -1 } },
//     ],
//     (err, result) => {
//       let quizPlayed = 0;
//       const users = result.map((obj) => {
//         quizPlayed = quizPlayed + obj.score;
//         const data = {
//           userId: obj._id.userId[0],
//           fullName: obj._id.fullName[0],
//           isWinner: obj._id.isWinner[0],
//           numOfGames: obj.score,
//         };
//         return data;
//       });

//       res.json({
//         users: users,
//         quizPlayed: quizPlayed,
//       });
//     }
//   );
// };

// exports.numOfGames = (req, res, next) => {
//   Quiz.aggregate(
//     [
//       {
//         $match: { score: { $gte: 0 } },
//       },
//       {
//         $project: { _id: 1, takenBy: 1, score: 1 },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "takenBy",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $group: {
//           _id: { userId: "$user._id", fullName: "$user.fullName" },
//           score: { $sum: 1 },
//         },
//       },
//       { $sort: { score: -1 } },
//     ],
//     (err, result) => {
//       let quizPlayed = 0;
//       result.forEach((obj) => {
//         quizPlayed = quizPlayed + obj.score;
//       });

//       quizPlayed = quizPlayed + 49918; // Because I deleted 49918 quizzes

//       res.json({
//         quizPlayed: quizPlayed,
//       });
//     }
//   );
// };

// exports.activeGames = (req, res, next) => {
//   const time = new Date(Date.now() - 10 * 60 * 1000);
//   Quiz.aggregate(
//     [
//       {
//         $match: { createdAt: { $gt: time }, active: true },
//       },
//       {
//         $project: { _id: 1, takenBy: 1, score: 1 },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "takenBy",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $group: {
//           _id: { userId: "$user._id", fullName: "$user.fullName" },
//           score: { $sum: 1 },
//         },
//       },
//       { $sort: { score: -1 } },
//     ],
//     (err, result) => {
//       let activeGames = 0;
//       result.forEach((obj) => {
//         activeGames = activeGames + obj.score;
//       });

//       res.json({
//         activeGames: activeGames,
//       });
//     }
//   );
// };

// exports.playedToday = (req, res, next) => {
//   const today = new Date();
//   today.setHours(0);
//   today.setMinutes(0);
//   today.setSeconds(0);
//   const tomorrow = new Date(today);
//   tomorrow.setDate(tomorrow.getDate() + 1);
//   tomorrow.setHours(0);
//   tomorrow.setMinutes(0);
//   tomorrow.setSeconds(0);

//   Quiz.aggregate(
//     [
//       {
//         $match: { createdAt: { $gt: today }, updatedAt: { $lt: tomorrow } },
//       },
//       {
//         $project: { _id: 1, takenBy: 1, score: 1 },
//       },
//       {
//         $lookup: {
//           from: "users",
//           localField: "takenBy",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       {
//         $group: {
//           _id: { userId: "$user._id", fullName: "$user.fullName" },
//           score: { $sum: 1 },
//         },
//       },
//       { $sort: { score: -1 } },
//     ],
//     (err, result) => {
//       let activeGames = 0;
//       result.forEach((obj) => {
//         activeGames = activeGames + obj.score;
//       });

//       res.json({
//         playedToday: activeGames,
//       });
//     }
//   );
// };

// exports.resetQuestionInfo = (req, res, next) => {
//   Question.find().then((questions) => {
//     questions.forEach((question) => {
//       question.answeredCorrectly = 0;
//       question.answeredIncorrectly = 0;
//       question.save();
//     });
//     res.json({ reset: "Reset successful" });
//   });
// };

// exports.changeQuestionsPoints = (req, res, next) => {
//   Question.find().then((questions) => {
//     let changes = 0;
//     questions.forEach((question) => {
//       if (question.points === 5) {
//         question.points = 10;
//         question.save();
//         changes = changes + 1;
//       } else if (question.points === 8) {
//         question.points = 15;
//         question.save();
//         changes = changes + 1;
//       } else if (question.points === 10) {
//         question.points = 20;
//         question.save();
//         changes = changes + 1;
//       }
//     });
//     res.json({
//       successfulChanges: changes,
//     });
//   });
// };