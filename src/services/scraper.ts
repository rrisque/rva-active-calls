import { ActiveCall } from '../types';

const ACTIVE_CALLS_URL =
  'https://apps.richmondgov.com/applications/activecalls/Home/ActiveCalls';

export async function fetchActiveCalls(): Promise<ActiveCall[]> {
  const response = await fetch(ACTIVE_CALLS_URL, {
    headers: {
      'User-Agent': 'RVA-ActiveCalls-App/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch active calls: ${response.status}`);
  }

  const html = await response.text();
  return parseActiveCalls(html);
}

function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function parseActiveCalls(html: string): ActiveCall[] {
  const calls: ActiveCall[] = [];

  // Match each <tr> that contains <td> cells
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowHtml = rowMatch[1];
    const cells: string[] = [];

    let cellMatch: RegExpExecArray | null;
    // Reset lastIndex for cellRegex each row
    cellRegex.lastIndex = 0;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(decodeEntities(stripTags(cellMatch[1])));
    }

    if (cells.length < 7) continue;

    const timeReceived = cells[0];
    const agency = cells[1];
    const dispatchArea = cells[2];
    const unit = cells[3];
    const callType = cells[4];
    const location = cells[5];
    const status = cells[6];

    if (!timeReceived || !location) continue;
    // Skip header row
    if (timeReceived === 'Time Received') continue;

    const id = `${timeReceived}-${location}-${unit}-${calls.length}`;

    calls.push({
      id,
      timeReceived,
      agency,
      dispatchArea,
      unit,
      callType,
      location,
      status,
    });
  }

  return calls;
}
