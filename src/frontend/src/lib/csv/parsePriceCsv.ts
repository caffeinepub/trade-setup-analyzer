export interface PriceData {
  date: Date;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface ParseResult {
  data: PriceData[];
  errors: string[];
}

export function parsePriceCsv(csvText: string): ParseResult {
  const errors: string[] = [];
  const data: PriceData[] = [];

  try {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      errors.push('CSV file must contain at least a header row and one data row');
      return { data, errors };
    }

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
    const dateIndex = header.findIndex((h) => h === 'date' || h === 'time' || h === 'datetime');
    const closeIndex = header.findIndex((h) => h === 'close' || h === 'price');
    const openIndex = header.findIndex((h) => h === 'open');
    const highIndex = header.findIndex((h) => h === 'high');
    const lowIndex = header.findIndex((h) => h === 'low');
    const volumeIndex = header.findIndex((h) => h === 'volume');

    if (dateIndex === -1) {
      errors.push('CSV must contain a "date" column');
      return { data, errors };
    }

    if (closeIndex === -1) {
      errors.push('CSV must contain a "close" or "price" column');
      return { data, errors };
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',').map((v) => v.trim());
      if (values.length < header.length) {
        errors.push(`Row ${i + 1}: Insufficient columns`);
        continue;
      }

      const dateStr = values[dateIndex];
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        errors.push(`Row ${i + 1}: Invalid date "${dateStr}"`);
        continue;
      }

      const close = parseFloat(values[closeIndex]);
      if (isNaN(close)) {
        errors.push(`Row ${i + 1}: Invalid close price`);
        continue;
      }

      const priceData: PriceData = { date, close };

      if (openIndex !== -1) {
        const open = parseFloat(values[openIndex]);
        if (!isNaN(open)) priceData.open = open;
      }

      if (highIndex !== -1) {
        const high = parseFloat(values[highIndex]);
        if (!isNaN(high)) priceData.high = high;
      }

      if (lowIndex !== -1) {
        const low = parseFloat(values[lowIndex]);
        if (!isNaN(low)) priceData.low = low;
      }

      if (volumeIndex !== -1) {
        const volume = parseFloat(values[volumeIndex]);
        if (!isNaN(volume)) priceData.volume = volume;
      }

      data.push(priceData);
    }

    // Sort by date ascending
    data.sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch (error) {
    errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { data, errors };
}
