import mongoose, { Schema, InferSchemaType, Model, Types } from "mongoose";

// A single frozen bundle in AWS Glacier Deep Archive. One Archive == one .zip
// object in the cold bucket. The per-file listing lives in ArchiveItem so we
// can browse a frozen bundle WITHOUT restoring it (and without blowing past
// MongoDB's 16MB per-document limit on huge bundles).
const ArchiveSchema = new Schema(
  {
    // Who owns this archive (the person who paid to freeze it).
    ownerType: {
      type: String,
      enum: ["studio", "customer"],
      required: true,
      index: true,
    },
    // Mutable DISPLAY hint — not identity.
    ownerEmail: { type: String, required: true, index: true },
    // Stable internal owner = Account._id (provider-agnostic). Authoritative.
    ownerAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },
    // Optional context, mirroring the File model's linkage.
    studioId: { type: Schema.Types.ObjectId, ref: "Studio", default: null },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },

    // Human-facing name, e.g. "2019 Sharma Wedding".
    name: { type: String, required: true },

    // Which door created it:
    //   "active"     = Door A: zipped from loose files that were on iDrive.
    //   "direct-zip" = Door B: user uploaded a ready-made .zip.
    source: { type: String, enum: ["active", "direct-zip"], required: true },

    // The object key of the .zip inside the AWS Deep Archive bucket.
    bucketKey: { type: String, required: true, unique: true },
    // Temporary iDrive key while the zip is staged / being built (Door B, or
    // in-flight Door A). Cleared once it's safely in Deep Archive.
    stagingKey: { type: String, default: null },

    sizeBytes: { type: Number, default: 0 },
    fileCount: { type: Number, default: 0 },

    // Door A: the source folders (selected + descendants) to delete from the
    // hot drive once the archive is safely frozen. Files-to-archive are tracked
    // per-row in ArchiveItem.sourceKey.
    sourceFolderIds: {
      type: [Schema.Types.ObjectId],
      ref: "Folder",
      default: [],
    },

    // staging        -> uploaded/collecting, manifest not final
    // awaiting_payment -> priced, waiting for the 7+ year prepay
    // paid           -> payment cleared, queued for the transfer worker
    // archiving      -> worker is streaming/zipping into Deep Archive
    // archived       -> frozen and at rest (the normal resting state)
    // restoring      -> a restore has been requested (12-48h)
    // available      -> restored copy is temporarily downloadable
    // failed / deleted
    status: {
      type: String,
      enum: [
        "staging",
        "awaiting_payment",
        "paid",
        "archiving",
        "archived",
        "restoring",
        "available",
        "failed",
        "deleted",
      ],
      default: "staging",
      index: true,
    },

    // Whether to DELETE the source files after freezing. true = "delete copies"
    // (studio direct-archive always deletes); false = "keep a copy" (customer
    // chose to leave the originals in place).
    deleteSources: { type: Boolean, default: true },

    // Prepaid term the user chose: 7..100 years.
    termYears: { type: Number, min: 7, max: 100, default: 7 },
    pricePaid: { type: Number, default: 0 },
    currency: { type: String, enum: ["USD", "INR"], default: "USD" },
    paidAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    // archivedAt + termYears; used later for end-of-term lifecycle.
    expiresAt: { type: Date, default: null },

    // Set while a restore is in flight / available.
    restore: {
      requestedAt: { type: Date, default: null },
      availableUntil: { type: Date, default: null },
      tier: { type: String, enum: ["Standard", "Bulk"], default: "Bulk" },
      feePaid: { type: Number, default: 0 },
      currency: { type: String, enum: ["USD", "INR"], default: "USD" },
    },

    error: { type: String, default: "" },
  },
  { timestamps: true }
);

export type ArchiveType = InferSchemaType<typeof ArchiveSchema> & {
  _id: Types.ObjectId;
};

export const ArchiveModel: Model<ArchiveType> =
  (mongoose.models.Archive as Model<ArchiveType>) ||
  mongoose.model<ArchiveType>("Archive", ArchiveSchema);
