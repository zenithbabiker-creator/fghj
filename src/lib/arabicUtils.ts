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

  // 6. Clean punctuation and redundant spaces (preserve alphanumeric and arabic characters)
  normalized = normalized.replace(/[^\w\s\u0600-\u06FF]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Strips all spaces, hyphens, underscores and symbols for dense alphanumeric matching
 * e.g. "RDB-107", "RDB 107", "rdb_107" all normalize to "rdb107"
 */
export function toDenseCode(text: string): string {
  if (!text) return '';
  return normalizeArabicText(text).replace(/[\s\-_/.]/g, '');
}

/**
 * Checks if a target string matches a query using multi-token & partial matching
 * e.g., query "ماكينة قهوة" matches target "ماكينة إعداد القهوة المتقدمة"
 * or query "RDB107" matches "RDB 107" or "RDB-107"
 */
export function matchesArabicQuery(target: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!target) return false;

  const normalizedTarget = normalizeArabicText(target);
  const normalizedQuery = normalizeArabicText(query);

  // Dense match check for codes (e.g. "rdb107" vs "rdb 107")
  const denseTarget = toDenseCode(target);
  const denseQuery = toDenseCode(query);
  if (denseQuery.length > 0 && denseTarget.includes(denseQuery)) {
    return true;
  }

  // Split query into tokens (individual words)
  const queryTokens = normalizedQuery.split(' ').filter(token => token.length > 0);

  if (queryTokens.length === 0) return true;

  // Target matches if EVERY token in the query appears somewhere in the target string
  return queryTokens.every(token => normalizedTarget.includes(token));
}

/**
 * Ranks items based on search query match quality
 * Resilient against any code structure (NASSER-101, RDB 107, 107, custom alphanumeric)
 */
export function searchAndRank<T>(
  items: T[],
  query: string,
  extractFields: (item: T) => (string | undefined)[]
): T[] {
  if (!query || !query.trim()) return items;

  const normalizedQuery = normalizeArabicText(query);
  const denseQuery = toDenseCode(query);
  const queryTokens = normalizedQuery.split(' ').filter(t => t.length > 0);

  return items
    .map(item => {
      const rawFields = extractFields(item).map(f => f || '');
      const fields = rawFields.map(f => normalizeArabicText(f));
      const denseFields = rawFields.map(f => toDenseCode(f));
      const combined = fields.join(' ');
      const denseCombined = denseFields.join('');

      // Check token match or dense match
      const tokenMatch = queryTokens.length > 0 && queryTokens.every(token => combined.includes(token));
      const denseMatch = denseQuery.length > 0 && denseCombined.includes(denseQuery);

      if (!tokenMatch && !denseMatch) return { item, score: -1 };

      // Calculate score: exact matches & code matches get highest score
      let score = 0;

      // Exact dense match on any field (e.g. searching "rdb107" on code "RDB-107" or "RDB 107")
      if (denseFields.some(df => df === denseQuery)) score += 100;
      else if (denseFields.some(df => df.startsWith(denseQuery))) score += 70;
      else if (denseMatch) score += 40;

      // Exact phrase match
      if (combined.includes(normalizedQuery)) score += 50;

      // Individual token matches
      queryTokens.forEach(token => {
        fields.forEach(field => {
          if (field === token) score += 30;
          else if (field.startsWith(token)) score += 15;
          else if (field.includes(token)) score += 5;
        });
      });

      return { item, score };
    })
    .filter(res => res.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(res => res.item);
}
