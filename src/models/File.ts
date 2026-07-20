import mongoose, { Schema, InferSchemaType, Model, Types } from "mongoose";

// One uploaded photo or video, belonging to a customer (and their studio).
const FileSchema = new Schema(
  {
    // Set for studio deliveries; null for a customer's own private uploads.
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
    // Who owns (uploaded) this item. "studio" = delivered by the studio;
    // "customer" = the customer's own private upload.
    ownerType: {
      type: String,
      enum: ["studio", "customer"],
      default: "studio",
      index: true,
    },
    // Owner's email (lowercased) — the stable identity of the owner.
    ownerEmail: { type: String, default: "", index: true },
    // Which folder this file lives in. null = the customer's root.
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    // The object key inside the iDrive bucket.
    key: { type: String, required: true, unique: true },
    filename: { type: String, required: true },
    contentType: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    // "pending" until the browser confirms the upload finished.
    status: {
      type: String,
      enum: ["pending", "ready"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export type FileType = InferSchemaType<typeof FileSchema> & {
  _id: Types.ObjectId;
};

export const FileModel: Model<FileType> =
  (mongoose.models.File as Model<FileType>) ||
  mongoose.model<FileType>("File", FileSchema);
