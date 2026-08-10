/**
 * Arabic Text Normalization and Multi-Token Matching Utilities
 * for شركة NASSER Search Engine
 */

export function toArabicNumerals(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return '';
  let str = String(val);
  // Convert any Eastern Arabic / Indian numerals (٠-٩) to standard Western digits (0-9)
  const map: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  return str.replace(/[٠-٩]/g, (d) => map[d] || d);
}

export function formatArabicNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(num)) return toArabicNumerals(val);
  return toArabicNumerals(num.toLocaleString('en-US'));
}

export function normalizeArabicText(text: string): string {
  if (!text) return '';

  let normalized = text.toLowerCase();

  // Normalize Eastern Arabic numerals (٠-٩) to Western digits (0-9) for search matching
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  easternDigits.forEach((digit, index) => {
    normalized = normalized.replace(new RegExp(digit, 'g'), index.toString());
  });

  // 1. Remove Arabic Tashkeel / Diacritics
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, '');

  // 2. Normalize Alef variations (أ, إ, آ, ٱ -> ا)
  normalized = normalized.replace(/[أإآٱ]/g, 'ا');

  // 3. Normalize Teh Marbuta and Heh (ة -> ه)
  normalized = normalized.replace(/ة/g, 'ه');

  // 4. Normalize Yeh and Alef Maksura (ى -> ي)
  normalized = normalized.replace(/ى/g, 'ي');

  // 5. Normalize Hamza forms (ؤ, ئ -> ء)
  normalized = normalized.replace(/[ؤئ]/g, 'ء');

  // 6. Clean punctuation and redundant spaces
  normalized = normalized.replace(/[^\w\s\u0600-\u06FF]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Checks if a target string matches a query using multi-token & partial matching
 * e.g., query "ماكينة قهوة" matches target "ماكينة إعداد القهوة المتقدمة"
 */
export function matchesArabicQuery(target: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;

  const normalizedTarget = normalizeArabicText(target);
  const normalizedQuery = normalizeArabicText(query);

  // Split query into tokens (individual words)
  const queryTokens = normalizedQuery.split(' ').filter(token => token.length > 0);

  if (queryTokens.length === 0) return true;

  // Target matches if EVERY token in the query appears somewhere in the target string
  return queryTokens.every(token => normalizedTarget.includes(token));
}

/**
 * Ranks items based on search query match quality
 */
export function searchAndRank<T>(
  items: T[],
  query: string,
  extractFields: (item: T) => (string | undefined)[]
): T[] {
  if (!query || !query.trim()) return items;

  const normalizedQuery = normalizeArabicText(query);
  const queryTokens = normalizedQuery.split(' ').filter(t => t.length > 0);

  return items
    .map(item => {
      const fields = extractFields(item).map(f => normalizeArabicText(f || ''));
      const combined = fields.join(' ');

      // Check if all tokens match
      const isMatch = queryTokens.every(token => combined.includes(token));

      if (!isMatch) return { item, score: -1 };

      // Calculate score: exact matches get higher score
      let score = 0;
      if (combined.includes(normalizedQuery)) score += 50; // exact phrase match
      queryTokens.forEach(token => {
        fields.forEach(field => {
          if (field.startsWith(token)) score += 10;
          else if (field.includes(token)) score += 5;
        });
      });

      return { item, score };
    })
    .filter(res => res.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(res => res.item);
}
