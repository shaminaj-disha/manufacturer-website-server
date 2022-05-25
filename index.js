const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.umln1.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next();
    })
}

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db("manufacturer").collection("tools");
        const blogsCollection = client.db("manufacturer").collection("blogs");
        const purchaseCollection = client.db("manufacturer").collection("purchase");
        const userCollection = client.db('manufacturer').collection('users');
        const reviewCollection = client.db('manufacturer').collection('review');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        // tools api
        // get tools
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });

        // get tools by id
        app.get('/tools/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const tool = await toolsCollection.findOne(query);
            res.send(tool);
        });

        // get blogs
        app.get('/blogs', async (req, res) => {
            const query = {};
            const cursor = blogsCollection.find(query);
            const blogs = await cursor.toArray();
            res.send(blogs);
        });

        // get users
        app.get('/user', verifyJWT, verifyAdmin, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        // get all purchase orders
        app.get('/purchase', verifyJWT, verifyAdmin, async (req, res) => {
            const orders = await purchaseCollection.find().toArray();
            return res.send(orders);
        });

        // get purchase orders by email
        app.get('/purchase', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const purchases = await purchaseCollection.find(query).toArray();
                return res.send(purchases);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        });

        // get reviews
        app.get('/review', async (req, res) => {
            const reviews = await reviewCollection.find().toArray();
            res.send(reviews);
        })

            // get admin
            .get('/admin/:email', async (req, res) => {
                const email = req.params.email;
                const user = await userCollection.findOne({ email: email });
                const isAdmin = user.role === 'admin';
                res.send({ admin: isAdmin })
            })

        // post a tool
        app.post('/tools', async (req, res) => {
            const tool = req.body;
            console.log(req.body);
            const result = await toolsCollection.insertOne(tool);
            res.send(result);
        });

        // post a review
        app.post('/review', async (req, res) => {
            const review = req.body;
            console.log(req.body);
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        });

        // post purchase
        app.post('/purchase', verifyJWT, async (req, res) => {
            const purchase = req.body;
            // const query = { toolName: purchase.toolName, unitPrice: purchase.unitPrice, quantity: purchase.quantity, totalPrice: purchase.totalPrice, email: purchase.email, name: purchase.name, phone: purchase.phone, address: purchase.address };
            // const exists = await purchaseCollection.findOne(query);
            // if (exists) {
            //     return res.send({ success: false, purchase: exists });
            // }
            const result = await purchaseCollection.insertOne(purchase);
            return res.send({ success: true, result });
        });

        // Put Users to Database
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, token });
        });

        // put admin role
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        // delete purchase order
        app.delete('/purchase/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await purchaseCollection.deleteOne(query);
            res.send(result);
        });

        // delete user
        app.delete('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const result = await userCollection.deleteOne(filter);
            res.send(result);
        });

    } finally {
        //   await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Server is running');
})

app.listen(port, () => {
    console.log('Listening to port, ', port);
})