import mongoose, { Schema, InferSchemaType, Model, Types } from "mongoose";

// One per logged-in user (by Clerk id). Holds account-level setup + subscription
// state chosen on the Setup page — separate from per-studio delivery records.
const AccountSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    // "personal" = customer role; "business" = studio role.
    type: { type: String, enum: ["personal", "business"], required: true },
    // "pending" until a plan is chosen (personal) / subscribed (business).
    subscriptionStatus: {
      type: String,
      enum: ["pending", "active"],
      default: "pending",
    },

    // Personal accounts (the 15-day trial is NOT here — it lives on the
    // per-studio Customer record for the shared/delivered data only):
    planId: { type: String, default: null },
    planBytes: { type: Number, default: 0 },

    // Business accounts:
    businessName: { type: String, default: "" },
    avgCustomersMonthly: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export type AccountType = InferSchemaType<typeof AccountSchema> & {
  _id: Types.ObjectId;
};

export const Account: Model<AccountType> =
  (mongoose.models.Account as Model<AccountType>) ||
  mongoose.model<AccountType>("Account", AccountSchema);
