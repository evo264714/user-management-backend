const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xmw7zrv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db("userManagement");
    const usersCollection = db.collection("users");

    const checkUserStatus = async (req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) return res.status(401).send('Unauthorized');

      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const user = await usersCollection.findOne({ id: decodedToken.uid });
        if (user.status === 'blocked') {
          return res.status(403).send('User is blocked');
        }
        req.user = user;
        next();
      } catch (error) {
        res.status(401).send('Unauthorized');
      }
    };

    app.post('/api/users', async (req, res) => {
      const { id, name, email, registrationTime, status } = req.body;
      const newUser = { id, name, email, registrationTime, status };
      await usersCollection.insertOne(newUser);
      res.sendStatus(201);
    });

    app.use(checkUserStatus);

    app.get('/api/users', async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.json(users);
    });

    app.post('/api/users/:id/block', async (req, res) => {
      const userId = req.params.id;
      await usersCollection.updateOne({ id: userId }, { $set: { status: "blocked" } });
      res.sendStatus(200);
    });

    app.post('/api/users/:id/unblock', async (req, res) => {
      const userId = req.params.id;
      await usersCollection.updateOne({ id: userId }, { $set: { status: "active" } });
      res.sendStatus(200);
    });

    app.delete('/api/users/:id', async (req, res) => {
      const userId = req.params.id;
      await usersCollection.deleteOne({ id: userId });
      res.sendStatus(200);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('server is running');
})

app.listen(port, () => {
  console.log(`server is running on port: ${port}`);
})
