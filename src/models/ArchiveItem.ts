import mongoose, { Schema, InferSchemaType, Model, Types } from "mongoose";

// One file INSIDE an archived .zip. This is the "manifest" - it lets us show
// the full contents of a frozen bundle (names, sizes, folder paths, thumbnails)
// instantly, without paying to restore the underlying Deep Archive object.
const ArchiveItemSchema = new Schema(
  {
    archiveId: {
      type: Schema.Types.ObjectId,
      ref: "Archive",
      required: true,
      index: true,
    },
    ownerEmail: { type: String, required: true, index: true },
    ownerAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
      index: true,
    },

    // Folder path inside the zip, e.g. "Ceremony/RAW". "" = zip root.
    path: { type: String, default: "" },
    filename: { type: String, required: true },
    size: { type: Number, default: 0 },
    contentType: { type: String, default: "application/octet-stream" },

    // iDrive key of the ORIGINAL loose file, used by the worker to stream it
    // into the zip. The original is deleted once the archive is frozen, so this
    // becomes historical provenance after that.
    sourceKey: { type: String, default: null },

    // iDrive key of a small preview kept HOT so frozen galleries stay browsable
    // (Door A only; Door B zips have no thumbnails unless we unzip later).
    thumbnailKey: { type: String, default: null },

    // Byte position of this entry within the zip. Recorded for a possible
    // future "extract one file after a full restore" feature; not used yet.
    offset: { type: Number, default: null },
    compressedSize: { type: Number, default: null },
  },
  { timestamps: true }
);

export type ArchiveItemType = InferSchemaType<typeof ArchiveItemSchema> & {
  _id: Types.ObjectId;
};

export const ArchiveItemModel: Model<ArchiveItemType> =
  (mongoose.models.ArchiveItem as Model<ArchiveItemType>) ||
  mongoose.model<ArchiveItemType>("ArchiveItem", ArchiveItemSchema);
