import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Extract the following fields from this vehicle registration document.
Different U.S. states use different label names — use your best judgment.

Examples of state label variations:
- Pennsylvania: PLATE, TITLE, VIN, YR/MAKE, REG. GROSS WT, COMB. GROSS WT, EXPIRY
- Maryland: PLATE NO, TITLE NO, VIN, YEAR, MAKE, GR VEHICLE WT, GR COMB WT, EXPIRES
- Texas: LICENSE PLATE, TITLE NUMBER, VIN, YEAR, MAKE, GVWR, GCWR, EXPIRATION DATE

Return ONLY a valid JSON object with these exact keys (use null if not found):

{
  "plate": null,
  "year": null,
  "make": null,
  "vin": null,
  "gross_vehicle_weight": null,
  "gross_combined_weight": null,
  "title_number": null,
  "expiration_date": null,
  "state": null
}

No text before or after the JSON. No markdown fences. No explanations.`;

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Incomplete JSON in response');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { filename = '', base64, mimeType = '' } = req.body;
  if (!base64) return res.status(400).json({ error: 'No file data received' });

  try {
    const isPdf =
      mimeType === 'application/pdf' ||
      filename.toLowerCase().endsWith('.pdf');

    const fileBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: base64 } };

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
    });

    const raw = response.content[0].text.trim();
    console.log('[extract raw]', raw.substring(0, 500));

    const json = extractJson(raw);
    return res.json(JSON.parse(json));
  } catch (err) {
    console.error('[extract error]', err.message);
    return res.status(500).json({ error: err.message });
  }
}