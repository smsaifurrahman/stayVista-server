/** @format */

const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const {
   MongoClient,
   ServerApiVersion,
   ObjectId,
   Timestamp,
} = require("mongodb");
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 8000;

// middleware
const corsOptions = {
   origin: ["http://localhost:5173", "http://localhost:5174"],
   credentials: true,
   optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
   const token = req.cookies?.token;
   console.log(token);
   if (!token) {
      return res.status(401).send({ message: "unauthorized access" });
   }
   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
         console.log(err);
         return res.status(401).send({ message: "unauthorized access" });
      }
      req.user = decoded;
      next();
   });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fjovpu5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@main.mq0mae1.mongodb.net/?retryWrites=true&w=majority&appName=Main`
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

async function run() {
   try {
      const roomCollection = client.db("stayvista").collection("rooms");
      const userCollection = client.db("stayvista").collection("users");

      // auth related api
      app.post("/jwt", async (req, res) => {
         const user = req.body;
         const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "365d",
         });
         res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
         }).send({ success: true });
      });
      // Logout
      app.get("/logout", async (req, res) => {
         try {
            res.clearCookie("token", {
               maxAge: 0,
               secure: process.env.NODE_ENV === "production",
               sameSite:
                  process.env.NODE_ENV === "production" ? "none" : "strict",
            }).send({ success: true });
            console.log("Logout successful");
         } catch (err) {
            res.status(500).send(err);
         }
      });

      //save user in db
      app.put("/user", async (req, res) => {
         const user = req.body;
         const query = { email: user?.email };
         const isExit = userCollection.findOne(query);

         if (isExit) {
          
            if (user.status === "Requested") {
              //if existing user want change his status
               const result = await userCollection.updateOne(query, {
                  $set: { status: user?.status },
               });
               return res.send(result);
            } else {
              // if exiting user login again
               return res.send(isExit);
            }
         }

         const options = { upsert: true };

         const updateDoc = {
            $set: {
               ...user,
               Timestamp: Date.now(),
            },
         };
         const result = await userCollection.updateOne(
            query,
            updateDoc,
            options
         );
         res.send(result);
      });

      //get all users data from db
      app.get("/users", async (req, res) => {
         const result = await userCollection.find().toArray();
         res.send(result);
      });

      //get all rooms from db
      app.get("/rooms", async (req, res) => {
         const category = req.query.category;
         let query = {};
         if (category && category !== "null") query = { category: category };
         const result = await roomCollection.find(query).toArray();
         res.send(result);
      });

      // delete a room
      app.delete("/room/:id", async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await roomCollection.deleteOne(query);
         res.send(result);
      });

      // Get a single room data from bd using id
      app.get("/rooms/:id", async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await roomCollection.findOne(query);
         res.send(result);
      });
      // Save a room data in db
      app.post("/room", async (req, res) => {
         const roomData = req.body;
         const result = await roomCollection.insertOne(roomData);
         res.send(result);
      });

      //get all rooms for Host
      app.get("/my-listings/:email", async (req, res) => {
         const email = req.params.email;
         let query = { "host.email": email };
         // if(category && category !=='null') query = {category: category};
         const result = await roomCollection.find(query).toArray();
         res.send(result);
      });

      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log(
         "Pinged your deployment. You successfully connected to MongoDB!"
      );
   } finally {
      // Ensures that the client will close when you finish/error
   }
}
run().catch(console.dir);

app.get("/", (req, res) => {
   res.send("Hello from StayVista Server..");
});

app.listen(port, () => {
   console.log(`StayVista is running on port ${port}`);
});
