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
  status: "pending" | "approved" | "rejected";
}

// ✅ বুকিং ডকুমেন্টের জন্য নতুন ইন্টারফেস (টাইপ সেফটির জন্য)
interface BookingDocument {
  turfId: string;
  turfName: string;
  location: string;
  pricePerHour: number;
  image: string;
  sportType: string;
  userEmail: string;
  userName: string;
  bookedAt: string;
}

interface UserDocument {
  _id: string;
  name: string;
  email: string;
  role?: "user" | "admin";
}

async function run() {
  try {
    await client.connect();
    console.log("🍃 Connected successfully to MongoDB!");

    const db = client.db("turf");
    const turfCollection = db.collection<TurfDocument>("allTurf");
    const bookingCollection = db.collection<BookingDocument>("bookings");
    const userCollection = db.collection<UserDocument>("user");

    async function isAdmin(email: string | undefined): Promise<boolean> {
      if (!email) return false;
      const user = await userCollection.findOne({ email });
      return user?.role === "admin";
    }

    app.post("/api/allTurfs", async (req: Request, res: Response) => {
      try {
        const newTurf = req.body;

        if (!newTurf.title || !newTurf.price) {
          res
            .status(400)
            .json({ success: false, message: "Title and Price are required!" });
          return;
        }

        const result = await turfCollection.insertOne(newTurf);

        res.status(201).json({
          success: true,
          message: "Arena added successfully!",
          data: result,
        });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, error: (error as Error).message });
      }
    });

    app.get("/api/allTurfs", async (req: Request, res: Response) => {
      try {
        const turfs = await turfCollection.find({}).toArray();
        res.json({ success: true, data: turfs });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, error: (error as Error).message });
      }
    });

    app.get("/api/allTurfs/:id", async (req: Request, res: Response) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          res
            .status(400)
            .json({ success: false, message: "Invalid ID format" });
          return;
        }

        const turf = await turfCollection.findOne({ _id: new ObjectId(id) });

        if (!turf) {
          res.status(404).json({ success: false, message: "Arena not found" });
          return;
        }

        res.json({ success: true, data: turf });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, error: (error as Error).message });
      }
    });

    app.get("/api/v1/user-items", async (req: Request, res: Response) => {
      try {
        const userEmail = req.query.email as string | undefined;

        if (!userEmail) {
          res
            .status(400)
            .json({ success: false, message: "User email is required" });
          return;
        }

        const result = await turfCollection
          .find({ ownerEmail: userEmail })
          .toArray();
        res.json({ success: true, data: result });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, error: (error as Error).message });
      }
    });

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
          res.status(403).json({
            success: false,
            message: "Unauthorized or item not found",
          });
          return;
        }

        res.json({ success: true, message: "Turf deleted successfully!" });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, error: (error as Error).message });
      }
    });

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
            ...(updatedData.pricePerHour && {
              price: Number(updatedData.pricePerHour),
            }),
          },
        };

        const result = await turfCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          res.status(403).json({
            success: false,
            message: "Unauthorized or item not found",
          });
          return;
        }

        res.json({ success: true, message: "Turf updated successfully!" });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, error: (error as Error).message });
      }
    });

    // ✅ বুকিং ক্রিয়েট করার এন্ডপয়েন্ট (টাইপ ফিক্সড)
    app.post("/api/bookings", async (req: Request, res: Response) => {
      try {
        const bookingData = req.body;
        const result = await bookingCollection.insertOne(bookingData);
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, message: (error as Error).message });
      }
    });

    // ✅ ফিক্সড স্কোপ: এই গেট রুটটিকে run() ট্রাই ব্লকের ভেতরে নিয়ে আসা হয়েছে
    app.get("/api/my-bookings", async (req: Request, res: Response) => {
      try {
        const userEmail = req.query.email as string | undefined;
        if (!userEmail) {
          res
            .status(400)
            .json({ success: false, message: "Email is required" });
          return;
        }

        const userBookings = await bookingCollection
          .find({ userEmail: userEmail })
          .toArray();
        res.json({ success: true, data: userBookings });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, message: (error as Error).message });
      }
    });

    // ADMIN

    // ✅ নতুন: অ্যাডমিন — সব turf দেখা (pending/approved/rejected সব)
    app.get("/api/admin/turfs", async (req: Request, res: Response) => {
      try {
        const email = req.query.email as string | undefined;
        if (!(await isAdmin(email))) {
          res
            .status(403)
            .json({ success: false, message: "Admin access required" });
          return;
        }

        const turfs = await turfCollection.find({}).toArray();
        res.json({ success: true, data: turfs });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, error: (error as Error).message });
      }
    });

    // ✅ নতুন: অ্যাডমিন — turf approve/reject করা
    app.patch(
      "/api/admin/turfs/:id/status",
      async (req: Request, res: Response) => {
        try {
          const id = req.params.id;
          const { email, status } = req.body as {
            email?: string;
            status?: string;
          };

          if (!(await isAdmin(email))) {
            res
              .status(403)
              .json({ success: false, message: "Admin access required" });
            return;
          }

          if (
            !ObjectId.isValid(id) ||
            (status !== "approved" && status !== "rejected")
          ) {
            res
              .status(400)
              .json({ success: false, message: "Invalid ID or status" });
            return;
          }

          const result = await turfCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status } },
          );

          if (result.matchedCount === 0) {
            res.status(404).json({ success: false, message: "Turf not found" });
            return;
          }

          res.json({ success: true, message: `Turf ${status} successfully!` });
        } catch (error) {
          res
            .status(500)
            .json({ success: false, error: (error as Error).message });
        }
      },
    );

    // ✅ নতুন: অ্যাডমিন — সব ইউজার দেখা
    app.get("/api/admin/users", async (req: Request, res: Response) => {
      try {
        const email = req.query.email as string | undefined;
        if (!(await isAdmin(email))) {
          res
            .status(403)
            .json({ success: false, message: "Admin access required" });
          return;
        }

        const users = await userCollection.find({}).toArray();
        res.json({ success: true, data: users });
      } catch (error) {
        res
          .status(500)
          .json({ success: false, error: (error as Error).message });
      }
    });

    app.patch(
      "/api/admin/users/:id/role",
      async (req: Request, res: Response) => {
        try {
          const id = req.params.id;
          const { email, role } = req.body as { email?: string; role?: string };

          if (!(await isAdmin(email))) {
            res
              .status(403)
              .json({ success: false, message: "Admin access required" });
            return;
          }

          if (role !== "user" && role !== "admin") {
            res.status(400).json({ success: false, message: "Invalid role" });
            return;
          }

          if (!ObjectId.isValid(id)) {
            res
              .status(400)
              .json({ success: false, message: "Invalid user ID format" });
            return;
          }

          // ✅ ফিক্স: string-কে ObjectId তে convert করে match করা হচ্ছে
          const result = await userCollection.updateOne(
            { _id: new ObjectId(id) as any }, // Better Auth এর UserDocument টাইপে _id: string বলা আছে, তাই runtime এ ObjectId হলেও TS কে "as any" দিয়ে জানাতে হচ্ছে
            { $set: { role } },
          );

          if (result.matchedCount === 0) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
          }

          res.json({ success: true, message: `Role updated to ${role}` });
        } catch (error) {
          res
            .status(500)
            .json({ success: false, error: (error as Error).message });
        }
      },
    );
  } catch (error) {
    console.error("Database connection error:", error);
  }
}

run().catch(console.dir);

app.get("/", (req: Request, res: Response) => {
  res.json("Hello World!wow");
});

app.listen(PORT, () => {
  console.log(`🚀 Server is rolling on http://localhost:${PORT}`);
});
