const mongoose = require("mongoose");

const ScanSchema = new mongoose.Schema(
  {
    loc: { type: String, required: true },
    at: { type: Date, required: true },
  },
  { _id: false }
);

const TeamSchema = new mongoose.Schema({
  teamNumber: { type: Number, required: true, unique: true },
  teamName: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },

  // Ordered list of location IDs this team must visit, in order.
  // The last entry is always "CSE".
  order: { type: [String], required: true },

  // Index into `order` of the NEXT location this team must find.
  // 0 = they're looking for order[0]. Equal to order.length once finished.
  currentIndex: { type: Number, default: 0 },

  scans: { type: [ScanSchema], default: [] },
  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },

  // Last GPS position the team's phone reported (opt-in, see POST /api/location).
  currentLocation: {
    type: new mongoose.Schema(
      {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
        updatedAt: { type: Date, required: true },
      },
      { _id: false }
    ),
    default: null,
  },
  locationEnabled: { type: Boolean, default: false },
});

module.exports = mongoose.model("Team", TeamSchema);
