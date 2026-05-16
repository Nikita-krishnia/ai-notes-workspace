const AI_SUFFIX = ' (AI Optimized)';
const DUPLICATE_BLOCK = `${AI_SUFFIX}${AI_SUFFIX}`;

/**
 * Collapse repeated trailing-style " (AI Optimized)" spam, e.g.
 * "Note (AI Optimized) (AI Optimized)" → "Note (AI Optimized)".
 */
function sanitizeDuplicateAiOptimized(title) {
  if (typeof title !== 'string') return '';
  let t = title.trim();
  while (t.includes(DUPLICATE_BLOCK)) {
    t = t.replace(DUPLICATE_BLOCK, AI_SUFFIX);
  }
  return t;
}

/**
 * For mock AI suggestion: append suffix once unless the title already mentions it.
 */
function buildSuggestedAiTitle(currentTitle) {
  const cleaned = sanitizeDuplicateAiOptimized(currentTitle || '');
  if (!cleaned) return `New Note${AI_SUFFIX}`;
  if (cleaned.includes('(AI Optimized)')) return cleaned;
  return `${cleaned}${AI_SUFFIX}`;
}

module.exports = {
  AI_SUFFIX,
  sanitizeDuplicateAiOptimized,
  buildSuggestedAiTitle,
};
