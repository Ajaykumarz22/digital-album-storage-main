import mongoose, { Schema, InferSchemaType, Model, Types } from "mongoose";

// A Customer is an end-customer (B2C) account created BY a studio, using the
// customer's email. It owns the photos/videos the studio uploads for them.
const CustomerSchema = new Schema(
  {
    studioId: {
      type: Schema.Types.ObjectId,
      ref: "Studio",
      required: true,
      index: true,
    },
    email: { type: String, required: true },
    name: { type: String, default: "" },

    // Set when the customer first logs in with this email (links to Clerk).
    clerkUserId: { type: String, default: null, index: true },

    // Total storage used by this customer's files, in bytes. Updated on upload.
    storageBytes: { type: Number, default: 0 },

    // Lifecycle: 15-day free trial -> subscribed, or -> locked (30-day grace) -> deleted.
    status: {
      type: String,
      enum: ["trial", "subscribed", "locked"],
      default: "trial",
    },
    trialEndsAt: { type: Date, required: true },
    // When status became "locked" (start of the 30-day grace period).
    lockedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A studio cannot create two customers with the same email.
CustomerSchema.index({ studioId: 1, email: 1 }, { unique: true });

export type CustomerType = InferSchemaType<typeof CustomerSchema> & {
  _id: Types.ObjectId;
};

export const Customer: Model<CustomerType> =
  (mongoose.models.Customer as Model<CustomerType>) ||
  mongoose.model<CustomerType>("Customer", CustomerSchema);
