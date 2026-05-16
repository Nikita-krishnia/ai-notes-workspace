const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.user._id }).sort({
      updatedAt: -1,
    });
    const totalNotes = notes.length;

    const tagCounts = {};
    for (const note of notes) {
      for (const tag of note.tags || []) {
        const key = String(tag).trim();
        if (!key) continue;
        tagCounts[key] = (tagCounts[key] || 0) + 1;
      }
    }

    const mostUsedTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const recentlyUpdated = notes.slice(0, 15).map((n) => ({
      id: n._id,
      title: n.title,
      updatedAt: n.updatedAt,
    }));

    res.json({ totalNotes, mostUsedTags, recentlyUpdated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
