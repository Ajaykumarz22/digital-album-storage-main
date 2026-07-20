import mongoose from "mongoose";

// The database connection string comes from .env.local (never hard-coded).
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "digital_album";

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

// Next.js reloads modules a lot in development, which would otherwise open a
// new database connection on every reload and exhaust the connection limit.
// We cache a single connection on the global object to reuse it.
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = global as typeof globalThis & {
  _mongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalWithMongoose._mongoose ?? { conn: null, promise: null };
globalWithMongoose._mongoose = cached;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      dbName: DB_NAME,
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
