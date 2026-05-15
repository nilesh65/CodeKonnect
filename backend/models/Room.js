import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },

    activeLanguage: {
      type: String,
      default: "javascript",
    },

    codes: {
      javascript: {
        type: String,
        default: "",
      },

      python: {
        type: String,
        default: "",
      },

      java: {
        type: String,
        default: "",
      },

      cpp: {
        type: String,
        default: "",
      },
    },
  },
  {
    timestamps: true,
  }
);

const Room = mongoose.model("Room", roomSchema);

export default Room;