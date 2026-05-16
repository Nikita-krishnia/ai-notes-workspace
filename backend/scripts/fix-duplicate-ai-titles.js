/**
 * One-off / manual cleanup: collapse duplicate " (AI Optimized)" fragments in titles.
 * Run from backend folder: node scripts/fix-duplicate-ai-titles.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { sanitizeDuplicateAiOptimized } = require('../utils/titleAiOptimized');

const DB_URI = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/peblo_notes';

async function run() {
  await mongoose.connect(DB_URI);
  const coll = mongoose.connection.collection('notes');
  let updated = 0;
  for await (const doc of coll.find({ title: /\(AI Optimized\)/ })) {
    const cleaned = sanitizeDuplicateAiOptimized(doc.title);
    if (cleaned !== doc.title) {
      await coll.updateOne({ _id: doc._id }, { $set: { title: cleaned } });
      updated++;
    }
  }
  console.log(updated ? `Updated ${updated} note(s).` : 'No duplicate AI title fragments found.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
