require('dotenv').config(); // MUST BE LINE 1
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const noteRoutes = require('./routes/noteRoutes');
const insightsRoutes = require('./routes/insightsRoutes');
const { sanitizeDuplicateAiOptimized } = require('./utils/titleAiOptimized');

const app = express();

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  }),
);
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/insights', insightsRoutes);

// 1. Connect to MongoDB
const DB_URI = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/peblo_notes';

/** Migrate legacy actionItems shaped as string[] → { text, isCompleted }[] using raw collection (safe before casts). */
async function migrateLegacyActionItems() {
  const coll = mongoose.connection.collection('notes');
  let count = 0;
  for await (const doc of coll.find({})) {
    const items = doc.actionItems;
    if (!Array.isArray(items) || !items.length || typeof items[0] !== 'string') {
      continue;
    }
    const updated = items.map((text) => ({
      text: String(text),
      isCompleted: false,
    }));
    await coll.updateOne({ _id: doc._id }, { $set: { actionItems: updated } });
    count++;
  }
  if (count) {
    console.log(`✅ Migrated legacy string actionItems on ${count} note(s)`);
  }
}

/** Dedupe chained " (AI Optimized)" in titles (legacy bug cleanup). */
async function migrateDuplicateAiOptimizedTitles() {
  const coll = mongoose.connection.collection('notes');
  let count = 0;
  for await (const doc of coll.find({ title: /\(AI Optimized\)/ })) {
    const cleaned = sanitizeDuplicateAiOptimized(doc.title);
    if (cleaned !== doc.title) {
      await coll.updateOne({ _id: doc._id }, { $set: { title: cleaned } });
      count++;
    }
  }
  if (count) {
    console.log(`✅ Cleaned duplicate "(AI Optimized)" in titles on ${count} note(s)`);
  }
}

mongoose
  .connect(DB_URI)
  .then(async () => {
    console.log('✅ Successfully connected to MongoDB local server');
    await migrateLegacyActionItems().catch((err) =>
      console.error('❌ actionItems migration error:', err.message),
    );
    await migrateDuplicateAiOptimizedTitles().catch((err) =>
      console.error('❌ AI title migration error:', err.message),
    );
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// 2. Simple Test Route
app.get('/', (req, res) => {
  res.send('Backend is running and trying to talk to MongoDB!');
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
