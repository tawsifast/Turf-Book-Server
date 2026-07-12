import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI environment variable is not set");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ডকুমেন্টের আসল shape অনুযায়ী interface
interface TurfDocument {
  title: string;
  location: string;
  sportType: "futsal" | "cricket" | "badminton";
  price: number;
  image: string;
  description: string;
  ownerName: string;
  ownerEmail: string;
}

async function run() {
  try {
    await client.connect();
    console.log("🍃 Connected successfully to MongoDB!");

    const db = client.db("turf");
    const turfCollection = db.collection<TurfDocument>("allTurf");

    app.post("/api/allTurfs", async (req: Request, res: Response) => {
      try {
        const newTurf = req.body;

        if (!newTurf.title || !newTurf.price) {
          res.status(400).json({ success: false, message: "Title and Price are required!" });
          return;
        }

        const result = await turfCollection.insertOne(newTurf);

        res.status(201).json({
          success: true,
          message: "Arena added successfully!",
          data: result,
        });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    app.get("/api/allTurfs", async (req: Request, res: Response) => {
      try {
        const turfs = await turfCollection.find({}).toArray();
        res.json({ success: true, data: turfs });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    app.get("/api/allTurfs/:id", async (req: Request, res: Response) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          res.status(400).json({ success: false, message: "Invalid ID format" });
          return;
        }

        const turf = await turfCollection.findOne({ _id: new ObjectId(id) });

        if (!turf) {
          res.status(404).json({ success: false, message: "Arena not found" });
          return;
        }

        res.json({ success: true, data: turf });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    //  ফিক্স: createdBy -> ownerEmail
    app.get("/api/v1/user-items", async (req: Request, res: Response) => {
      try {
        const userEmail = req.query.email as string | undefined;

        if (!userEmail) {
          res.status(400).json({ success: false, message: "User email is required" });
          return;
        }

        const result = await turfCollection.find({ ownerEmail: userEmail }).toArray();
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    //  ফিক্স: createdBy -> ownerEmail
    app.delete("/api/ownerTurfs/:id", async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const userEmail = req.query.email as string | undefined;

        if (!ObjectId.isValid(id) || !userEmail) {
          res.status(400).json({
            success: false,
            message: "Invalid ID format or missing user email",
          });
          return;
        }

        const result = await turfCollection.deleteOne({
          _id: new ObjectId(id),
          ownerEmail: userEmail,
        });

        if (result.deletedCount === 0) {
          res.status(403).json({ success: false, message: "Unauthorized or item not found" });
          return;
        }

        res.json({ success: true, message: "Turf deleted successfully!" });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

    // ফিক্স: createdBy -> ownerEmail
    app.patch("/api/ownerTurfs/:id", async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const { userEmail, ...updatedData } = req.body;

        if (!ObjectId.isValid(id) || typeof userEmail !== "string") {
          res.status(400).json({
            success: false,
            message: "Invalid ID format or missing user email",
          });
          return;
        }

        const filter = { _id: new ObjectId(id), ownerEmail: userEmail };

        const updateDoc = {
          $set: {
            ...(updatedData.name && { title: updatedData.name }),
            ...(updatedData.sportType && { sportType: updatedData.sportType }),
            ...(updatedData.pricePerHour && { price: Number(updatedData.pricePerHour) }),
          },
        };

        const result = await turfCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          res.status(403).json({ success: false, message: "Unauthorized or item not found" });
          return;
        }

        res.json({ success: true, message: "Turf updated successfully!" });
      } catch (error) {
        res.status(500).json({ success: false, error: (error as Error).message });
      }
    });

  } catch (error) {
    console.error(" Database connection error:", error);
  }
  // 🗑️ Dangling/অনিরাপদ duplicate delete route সরিয়ে দেওয়া হলো
  // (এটা try ব্লকের বাইরে ছিল, turfCollection স্কোপে ছিল না, এবং email check ছাড়াই delete করছিল)
}

run().catch(console.dir);

app.get("/", (req: Request, res: Response) => {
  res.json("Hello World!wow");
});

app.listen(PORT, () => {
  console.log(`🚀 Server is rolling on http://localhost:${PORT}`);
});