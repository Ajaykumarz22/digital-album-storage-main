import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// A Studio is one paying B2B customer. It is linked 1:1 to a Clerk login
// account via clerkUserId.
const StudioSchema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true },
    name: { type: String, default: "" },
    // $5/year plan status - wired up properly in the payments step.
    planStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
  },
  { timestamps: true }
);

export type StudioType = InferSchemaType<typeof StudioSchema>;

// Avoid "OverwriteModelError" when Next.js re-imports this file on reload.
export const Studio: Model<StudioType> =
  (mongoose.models.Studio as Model<StudioType>) ||
  mongoose.model<StudioType>("Studio", StudioSchema);
