/**
 * Parses a CSV string into an array of objects.
 * Handles double quotes, commas, and newlines within fields.
 * 
 * @param {string} csvText - The raw CSV string
 * @returns {Array<Object>} Array of parsed row objects
 */
export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0 || !lines[0].trim()) return [];

  // Parse headers and clean them up
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^["']|["']$/g, ''));

    // Construct object map matching header key to value
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] !== undefined ? values[index] : '';
    });
    results.push(obj);
  }

  return results;
}

/**
 * Formats an array of objects into a CSV string.
 * Escapes quotes and encapsulates values with commas/quotes when necessary.
 * 
 * @param {Array<Object>} data - Array of row data objects
 * @param {Array<string>} headers - Ordered list of headers to export
 * @returns {string} Fully formatted CSV text
 */
export function formatCSV(data, headers) {
  const headerLine = headers.join(',');
  const rowLines = data.map(row => {
    return headers
      .map(header => {
        const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
        const escaped = val.replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
          ? `"${escaped}"`
          : escaped;
      })
      .join(',');
  });

  return [headerLine, ...rowLines].join('\n');
}
