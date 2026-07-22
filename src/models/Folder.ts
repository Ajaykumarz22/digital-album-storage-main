import mongoose, { Schema, InferSchemaType, Model, Types } from "mongoose";

// A logical folder inside a customer's storage. parentId = null means it sits
// at the customer's root.
const FolderSchema = new Schema(
  {
    // Set for studio deliveries; null for a customer's own private folders.
    studioId: {
      type: Schema.Types.ObjectId,
      ref: "Studio",
      default: null,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    // Who owns this folder. "studio" = created by the studio for delivery;
    // "customer" = the customer's own private folder.
    ownerType: {
      type: String,
      enum: ["studio", "customer"],
      default: "studio",
      index: true,
    },
    ownerEmail: { type: String, default: "", index: true },
    // Stable internal owner = Account._id (provider-agnostic). What a customer's
    // own folders are scoped by; ownerEmail is now just a display hint.
    ownerAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

// No two folders with the same name under the same parent, per owner+space.
// (ownerAccountId scopes each user's private drive; customerId scopes each
// studio's per-customer delivery space.)
FolderSchema.index(
  { ownerType: 1, ownerAccountId: 1, customerId: 1, parentId: 1, name: 1 },
  { unique: true }
);

export type FolderType = InferSchemaType<typeof FolderSchema> & {
  _id: Types.ObjectId;
};

export const Folder: Model<FolderType> =
  (mongoose.models.Folder as Model<FolderType>) ||
  mongoose.model<FolderType>("Folder", FolderSchema);
