// import db from '../config/databases.ts'
// import validation from '../validation.ts'
// import hash from '../util/hash.ts'
// const user = db.collection('users')

// export default {
//     async index(ctx: any) {
//         const data = await user.find()
//         ctx.response.body = data
//     },
//     async show(ctx: any) {
//         try {
//             const data = await user.findOne({ _id: (ctx.params.id) })
//             ctx.response.body = data
//         } catch (e) {
//             ctx.response.status = 404
//             ctx.response.body = { error: "User does't exists in our database." }
//         }
//     },
//     async store(ctx: any) {
//         const value = await validation.validate(ctx)
//         value.created_at = parseInt((new Date().getTime() / 1000).toString())
//         value.password = hash.bcrypt(value.password)
//         if (value) {
//             const insertId = await user.insertOne(value)
//             ctx.response.status = 201
//             ctx.response.body = insertId
//         }
//     },
//     async update(ctx: any) {
//         const value = await validation.validateUpdate(ctx)
//         if (value) {
//             const data = {
//                 email: value.email,
//                 name: value.name,
//                 password: value.password,
//             }
//             try {
//                 await user.updateOne(
//                     { _id: ObjectId(ctx.params.id) },
//                     { $set: data }
//                 )
//                 ctx.response.status = 200
//                 ctx.response.body = { message: 'updated' }
//             } catch (e) {
//                 ctx.response.status = 404
//                 ctx.response.body = {
//                     error: "User does't exists in our database.",
//                 }
//             }
//         }
//     },
//     async destroy(ctx: any) {
//         try {
//             await user.deleteOne({ _id: ObjectId(ctx.params.id) })
//             ctx.response.status = 204 // no content
//         } catch (e) {
//             ctx.response.status = 404
//             ctx.response.body = { error: "User does't exists in our database." }
//         }
//     },
//     async signup(ctx: any) {
//         const { request, response } = ctx
//         const { email, password, fullName } = request.body
//         console.log(request)
//         let isAdmin = false
//         // if (ctx.body.isAdmin === `${process.env.ADMIN_KEY}`) {
//         //   isAdmin = true;
//         // }
//         const hashedPw = await hash.bcrypt(password)
//         const newUser = await user.insertOne({
//             email: email,
//             password: hashedPw,
//             fullName: fullName,
//             isAdmin: isAdmin,
//         })
//         // return user.save();
//         ctx.statusCode = 201
//         ctx.response = { message: 'User created!', userId: newUser._id }

//         // if (!err.statusCode) {
//         //   err.statusCode = 500;
//         // }
//     },
// }
