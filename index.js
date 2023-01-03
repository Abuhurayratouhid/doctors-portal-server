const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET);
// console.log(process.env.STRIPE_SECRET)

// middleware
app.use(cors())
app.use(express.json())

// mongo db connection 
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

// function verifyJWT(req, res, next){
//     const header = req.headers.authorization
//     if(!header){
//         return res.status(401).send({message: 'unauthorized access'})
//     }

//     const token = header.split(' ')[1];

//     jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
//         if(err){
//            return res.status(403).send({message: 'no access'})
//         }
//         req.decoded = decoded;
//         next();
//     })
//     // console.log(token)
// }

async function run() {
    try {
        const doctorsPortalDB = client.db('doctorsPortalDB');
        const appointmentCollection = doctorsPortalDB.collection('appointmentCollection');
        const bookingsCollection = doctorsPortalDB.collection('bookingsCollection');
        const usersCollection = doctorsPortalDB.collection('usersCollection');
        const doctorsCollection = doctorsPortalDB.collection('doctorsCollection');


        // jwt 
        // app.get('/jwt',async(req,res)=>{
        //     const email = req.query.email;
        //     const query = {email: email};
        //     const user = await usersCollection.findOne(query)
        //     if(user){
        //         const token= jwt.sign({email}, process.env.ACCESS_TOKEN,{expiresIn: '1h'})
        //        return res.send({token: token})
        //     }
        //     return res.status(403).send({message: 'no access'})
        // })

        // get all doctors from DB 
        app.get('/doctors',async(req, res)=>{
            const query = {};
            const doctors = await doctorsCollection.find(query).toArray()
            res.send(doctors)
        })

        // add a doctor to DB 
        app.post('/doctors',async(req, res)=>{
            const doctor = req.body;
            const result = await doctorsCollection.insertOne(doctor)
            res.send(result)
        })

        // delete a doctor from DB 
        app.delete('/deleteDoctor/:id',async(req, res) =>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)}
            const result = await doctorsCollection.deleteOne(query);
            res.send(result)
        })

    //    get just name from appointment data  using  project

        app.get('/appointmentSpecialty', async(req, res)=>{
            const query = {};
            const specialty = await appointmentCollection.find(query).project({name: 1}).toArray();
            res.send(specialty);
        })

        // get appointmentCollection from mongo db 
        app.get('/appointments', async(req, res) =>{
            const date = req.query.date;
            const query = {}
            const options = await appointmentCollection.find(query).toArray();
            

            const bookingQuery = {appointmentDate: date}
            const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();
            options.forEach(option => {
                const optionBooked = alreadyBooked.filter(book => book.treatment === option.name )
                const bookedSlot = optionBooked.map(book => book.slot )
                const remainingSlots = option.slots.filter(slot => !bookedSlot.includes(slot))
                option.slots = remainingSlots;
                // console.log(date, option.name , remainingSlots.length)
            })

            res.send(options)
         
        })

        app.put('/addPrice',async(req, res)=>{
            const filter = {};
            const options = {upsert: true}
            const updatedDoc = {
                $set:{
                    price: 111
                }
            }
            const result = await appointmentCollection.updateMany(filter, updatedDoc,options)
            res.send(result)
        })

        // insert booking info to the DB 
        app.post('/bookings',async(req, res)=> {
            const booking = req.body;
            const query ={ 
                appointmentDate: booking.appointmentDate ,
                treatment : booking.treatment,
                email : booking.email 
            }
            const alreadyBooked = await bookingsCollection.find(query).toArray();
            if(alreadyBooked.length){
                const message = `You have already booked on ${booking.appointmentDate}`
                return res.send({acknowledged: false, message})
            }
            const result = await bookingsCollection.insertOne(booking)
            res.send(result);
        })


        // Not working when called from client side 
        app.get('/singleBooking/:id',async(req, res)=>{
            const id = req.params.id;
            // console.log('booking id',id)
            const query = {_id: ObjectId(id)}
            const singleBooking = await bookingsCollection.findOne(query);
            res.send(singleBooking)
        })


        // get booking info based on user email 
        app.get('/bookings',async(req, res )=>{
            const email = req.query.email;
            // const decodedEmail = req?.decoded?.email;
            // // console.log(decodedEmail, 'user email',email)
            // if(email !== decodedEmail){
            //     res.status(403).send({message: 'forbidden'})
            // }
            
            const query = {email: email}
            const appointments = await bookingsCollection.find(query).toArray();
            res.send(appointments)

        });

        // save user to the DB 
        app.post('/users', async(req, res)=>{
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // get all users from DB 
        app.get('/users',async(req, res)=> {
            const query = {};
            const users = await usersCollection.find(query).toArray();
            res.send(users)
        })

        // delete user from DB 
        app.delete('/deleteUser/:id', async(req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)}
            const user = await usersCollection.deleteOne(query);
            res.send(user)
        })

        // update user Role 
        app.put('/updateUser/:id', async(req, res)=>{
            const id = req.params.id;
            const filter = {_id: ObjectId(id)}
            const options = {upsert: true};
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter,updatedDoc,options)
            res.send(result)
        })

        // Create payment intent 
        // app.post('/create-payment-intent', async(req, res)=>{
        //     const booking = req.body;
        //     const price = booking.price;
        //     const amount = price * 100;

        //     const paymentIntent = await stripe.paymentIntents.create({
        //         currency : 'usd',
        //         amount: amount,
        //         "payment_method_types": [
        //             "card"
        //           ],
        //     });
        //     res.send({
        //         clientSecret: paymentIntent.client_secret,
        //       });
        // })
    }
    finally {

    }
}
run().catch(error => console.log(error))


app.get('/', async (req, res) => {
    res.send('doctors portal server is running')
})

app.listen(port, () => {
    console.log(`doctors portal server is running on ${port}`)
})
