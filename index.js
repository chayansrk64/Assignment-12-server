const express = require('express');
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


//Middlewares
app.use(cors())
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'unauthorized access'})
  }
  //bearer token
  const token = authorization.split(' ')[1]
  // console.log(token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=> {
    if(err){
      return res.status(403).send({error: true, message: 'forbidden access'})
    }
    req.decoded = decoded;
    next();
  })

}






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hkduy2w.mongodb.net/?retryWrites=true&w=majority`;
 

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classeCollection = client.db("photographDB").collection("classes");
    const usersCollection = client.db("photographDB").collection("users");
    const instructorCollection = client.db("photographDB").collection("instructors");
    const enrollCollection = client.db("photographDB").collection("enrolls");



    // jwt token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({token})
    })


    // verify admin middleware (call verifyAdmin after verifyJWT middleware)
    const verifyAdmin = async(req, res, next)=> {
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin') {
        return res.status(403).send({error: true, message: 'forbidden access'})
      }
      next();
    }

   app.get('/users', async(req, res) => {
    const result = await usersCollection.find().toArray()
    res.send(result)
   })

    app.get('/classes', async(req, res) => {
        const result = await classeCollection.find().toArray()
        res.send(result)
    })

    app.get('/instractors', async(req, res) => {
        const result = await instructorCollection.find().toArray()
        res.send(result)
    })

    app.post('/classes', async(req, res) => {
      const item = req.body;
      const result = await classeCollection.insertOne(item)
      res.send(result)

    })

   
    // users api
    app.get('/users', verifyJWT, verifyAdmin, async(req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })
    

    app.post('/users', async(req, res) => {
      const user = req.body;
      
      const query = {email: user.email}
      const existingUser = await usersCollection.findOne(query);
      
      if(existingUser){
        return res.send({message: "User is already exists"})
      }
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

   
    //secure admin
    app.get('/users/admin/:email', verifyJWT, async(req, res) => {
      const email = req.params.email;
      const query = {email: email};

      if(req.decoded.email !== email){
         res.send({admin: false})
      }

      const user = await usersCollection.findOne(query);
      const result = {admin: user?.role === 'admin'}
      res.send(result);
    })

 // make admin api
    app.patch('/users/admin/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })


    

    // make instructor api
    app.patch('/users/instructor/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'instructor'
        }
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })
//=============================================
     app.patch('/classes/approve/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'approve'
        }
      }
      const result = await classeCollection.updateOne(query, updateDoc)
      res.send(result)
    })

     app.patch('/classes/deny/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'deny'
        }
      }
      const result = await classeCollection.updateOne(query, updateDoc)
      res.send(result)
    })

 



// ============================================= 
    app.get('/users/instructor/:email', verifyJWT, async(req, res) => {
      const email = req.params.email;
      const query = {email: email};

      if(req.decoded.email !== email){
         res.send({instructor: false})
      }

      const user = await usersCollection.findOne(query);
      const result = {instructor: user?.role === 'instructor'}
      res.send(result);
    })
    

    // enrolls classes apis
    app.get('/enrolls', verifyJWT, async(req, res) => {
      const email = req.query.email;
      
      if(!email){
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if(email !== decodedEmail){
        return res.status(403).send({error: true, message: 'forbidden access'})
      }

      const query = {email: email};
      const result = await enrollCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/enrolls', async(req, res) => {
      const item = req.body;
      console.log(item);
      const result = await enrollCollection.insertOne(item);
      res.send(result)
    })
   
    app.delete('/enrolls/:id', async(req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await enrollCollection.deleteOne(query);
      res.send(result)
    })

 

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);












app.get('/', (req, res)=> {
    res.send("NEXT PHOTOGRAPH SERVER ON RUNNING...")
})

app.listen(port, () => {
    console.log(`SERVER IS RUNNING ON PORT : ${port}`);
})