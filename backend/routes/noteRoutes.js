
const express = require('express');
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const router = express.Router();
const Note = require('../models/Note');
const { protect } = require('../middleware/authMiddleware');
const { buildSuggestedAiTitle, sanitizeDuplicateAiOptimized } = require('../utils/titleAiOptimized');

function sanitizeActionItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((raw) => {
      if (typeof raw === 'string') {
        const text = raw.trim();
        return text ? { text, isCompleted: false } : null;
      }
      if (raw && typeof raw === 'object') {
        const text = typeof raw.text === 'string' ? raw.text.trim() : '';
        if (!text) return null;
        return { text, isCompleted: !!raw.isCompleted };
      }
      return null;
    })
    .filter(Boolean);
}

/** Extra delay before calling Gemini so clients can show a loading state (optional). */
const GENERATE_SUMMARY_DELAY_MS = 2000;

function getFallbackAiData(note) {
  const titlePreview = sanitizeDuplicateAiOptimized(note.title || '');
  return {
    summary: `This is an AI-generated summary of your note titled "${titlePreview || 'Untitled'}". It highlights the key points discussed in the content.`,
    actionItems: sanitizeActionItems([
      'Review the project requirements',
      'Finalize the database schema',
      'Prepare the frontend components',
    ]),
    suggestedTitle: buildSuggestedAiTitle(note.title),
  };
}

/**
 * Parses model output that should be bare JSON (we still strip accidental ``` fences).
 */
function parseGeminiJsonPayload(rawText) {
  let t = String(rawText || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(t);
  if (typeof parsed.summary !== 'string') {
    throw new Error('Invalid Gemini JSON: summary must be a string');
  }
  let actionItems = parsed.actionItems;
  if (!Array.isArray(actionItems)) actionItems = [];
  actionItems = actionItems.filter((x) => typeof x === 'string');

  let suggestedTitle = parsed.suggestedTitle;
  if (typeof suggestedTitle !== 'string') suggestedTitle = '';

  return {
    summary: parsed.summary.trim(),
    actionItems,
    suggestedTitle: suggestedTitle.trim(),
  };
}

async function fetchGroqSummary(note) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const noteBody = `${note.title || 'Untitled'}\n\n${note.content || '(no body)'}`;

  console.log('Sending request to Groq (Llama 3.3)...');
  
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a productivity assistant. Output ONLY a raw JSON object with the keys: 'summary' (string), 'actionItems' (array of strings), and 'suggestedTitle' (string). Do not include markdown or conversational text."
      },
      {
        role: "user",
        content: `Summarize this note: ${noteBody}`
      }
    ],
    model: "llama-3.3-70b-versatile",
    // This forces the model to return a valid JSON object
    response_format: { type: "json_object" },
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('Empty Groq response');

  const payload = JSON.parse(text);

  // Use your existing sanitizers to keep data consistent
  return {
    summary: payload.summary || 'No summary generated.',
    actionItems: sanitizeActionItems(payload.actionItems || []),
    suggestedTitle: buildSuggestedAiTitle(payload.suggestedTitle || note.title)
  };
}

// POST /api/notes/:id/generate-summary — Gemini 1.5 Flash with mock fallback
router.post('/:id/generate-summary', protect, async (req, res) => {
  try {
    // 1. Find the note and ensure it belongs to the logged-in user
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!note) return res.status(404).json({ message: 'Note not found' });

    // 2. Keep the artificial delay for that "AI is thinking" UX feel
    if (GENERATE_SUMMARY_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, GENERATE_SUMMARY_DELAY_MS));
    }

    let aiData;
    try {
      // 3. Call the new Groq function (ensure you've defined fetchGroqSummary)
      aiData = await fetchGroqSummary(note);
    } catch (groqErr) {
      console.warn('[generate-summary] Groq failed, using mock fallback:', groqErr.message || groqErr);
      // 4. Fallback if API key is invalid or rate limit hit
      aiData = getFallbackAiData(note);
    }

    // 5. Update the note with the AI results
    note.aiSummary = aiData.summary;
    note.actionItems = aiData.actionItems;
    note.title = aiData.suggestedTitle;
    
    await note.save();

    // 6. Return the updated note to the frontend
    res.json(note);
  } catch (err) {
    console.error("Route Error:", err);
    res.status(500).json({ error: 'Generate summary failed', details: err.message });
  }
});

// Public read — no auth (must stay before GET /:id)
router.get('/public/:shareId', async (req, res) => {
  try {
    const note = await Note.findOne({
      shareId: req.params.shareId,
      isPublic: true,
    }).select('-__v');
    if (!note) {
      return res.status(404).json({ message: 'Note not found or not public' });
    }
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    const note = await Note.create({
      userId: req.user._id,
      title: title ?? 'New Note',
      content: content ?? '',
      tags: Array.isArray(tags) ? tags : [],
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const { search, archived } = req.query;
    const query = { userId: req.user._id };

    if (archived === 'true') {
      query.isArchived = true;
    } else {
      query.isArchived = false;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { tags: { $regex: term, $options: 'i' } },
      ];
    }

    const notes = await Note.find(query).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const { title, content, tags, isArchived, isPublic, actionItems } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (tags !== undefined) note.tags = Array.isArray(tags) ? tags : note.tags;
    if (isArchived !== undefined) note.isArchived = !!isArchived;
    if (isPublic !== undefined) note.isPublic = !!isPublic;
    if (actionItems !== undefined) {
      note.actionItems = sanitizeActionItems(actionItems);
    }

    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const note = await Note.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!note) return res.status(404).json({ message: 'Note not found' });

    const { title, content, tags, isArchived, isPublic, actionItems } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (tags !== undefined) note.tags = Array.isArray(tags) ? tags : note.tags;
    if (isArchived !== undefined) note.isArchived = !!isArchived;
    if (isPublic !== undefined) note.isPublic = !!isPublic;
    if (actionItems !== undefined) {
      note.actionItems = sanitizeActionItems(actionItems);
    }

    await note.save();
    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
