const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const actionItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      default: 'New Note',
    },
    content: {
      type: String,
      default: '',
    },
    tags: [
      {
        type: String,
      },
    ],
    isArchived: {
      type: Boolean,
      default: false,
    },

    // Requirement 5: Public Share Page
    isPublic: {
      type: Boolean,
      default: false,
    },
    shareId: {
      type: String,
      unique: true,
      default: () => nanoid(10),
    },

    // Requirement 3: AI Integration
    aiSummary: {
      type: String,
      default: '',
    },
    actionItems: {
      type: [actionItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('Note', noteSchema);
