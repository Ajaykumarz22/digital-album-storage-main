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
    // Owner's email (lowercased) - a mutable DISPLAY hint, not identity.
    ownerEmail: { type: String, default: "", index: true },
    // Stable internal owner = Account._id. Provider-agnostic identity that
    // survives email changes and even swapping out the auth provider. This is
    // what customer-owned data is actually scoped by.
    ownerAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },
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
    // Cold Drive tag (applies to a customer's own files AND to studio-shared
    // files the customer has tagged - studio files are per-delivery so the tag
    // is unambiguous):
    //   "none"      = not selected.
    //   "selected"  = tagged "Selected for cold drive", waiting for payment.
    //                 The file STAYS visible where it is.
    //   "moved"     = archived to Cold Drive; a live copy is kept in place
    //                 (tagged "Moved to cold").
    //   "archiving" = paid, sources marked for deletion; worker is freezing then
    //                 removing them.
    deepStatus: {
      type: String,
      enum: ["none", "selected", "moved", "archiving"],
      default: "none",
      index: true,
    },
    // If this customer file was COPIED from a studio-shared file, the source
    // file's id - lets the shared view hide files the customer already took.
    sourceFileId: {
      type: Schema.Types.ObjectId,
      ref: "File",
      default: null,
      index: true,
    },
    // Which live tier a CUSTOMER-owned file sits in:
    //   "temporary" = free 15-day landing area (default for new uploads).
    //   "regular"   = paid permanent storage (counts against purchased quota).
    // Studio-owned deliveries are inherently temporary (via ownerType).
    tier: {
      type: String,
      enum: ["temporary", "regular"],
      default: "temporary",
      index: true,
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
