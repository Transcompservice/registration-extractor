import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Extract the following fields from this vehicle registration document.
Different U.S. states use different label names — use your best judgment.

Examples of state label variations:
- Pennsylvania: PLATE, TITLE, VIN, YR/MAKE, REG. GROSS WT, COMB. GROSS WT, EXPIRY
- Maryland: PLATE NO, TITLE NO, VIN, YEAR, MAKE, GR VEHICLE WT, GR COMB WT, EXPIRES
- Texas: LICENSE PLATE, TITLE NUMBER, VIN, YEAR, MAKE, GVWR, GCWR, EXPIRATION DATE

Return ONLY a valid JSON object with these exact keys (null if not found):

{
  "plate": "license plate number",
  "year": "4-digit model year (e.g. 2019) — look for YR/MAKE and extract just the year",
  "make": "vehicle manufacturer (e.g. FORD, FREIGHTLINER) — look for YR/MAKE and extract just the make",
  "vin": "17-character Vehicle Identification Number",
  "gross_vehicle_weight": "Gross Vehicle Weight — look for: GVW, GVWR, GR VEHICLE WT, REG. GROSS WT, GROSS WT",
  "gross_combined_weight": "Gross Combined Weight — look for: GCW, GCWR, GR COMB WT, COMB. GROSS WT",
  "title_number": "title number or certificate number — look for: TITLE, TITLE NO, TITLE NUMBER",
  "expiration_date": "registration expiration date formatted MM/DD/YYYY — look for: EXPIRY, EXPIRES, EXPIRATION",
  "state": "2-letter state abbreviation if visible (e.g. MD, TX, PA)"
}

Do not guess. Only extract what is clearly printed on the document.`;

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

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
      max_tokens: 600,
      messages: [{ role: 'user', content: [fileBlock, { type: 'text', text: PROMPT }] }],
    });

    let text = response.content[0].text.trim();

    // Strip markdown code fences if present
    if (text.startsWith('```')) {
      const lines = text.split('\n');
      const end = lines[lines.length - 1].trim() === '```' ? lines.length - 1 : lines.length;
      text = lines.slice(1, end).join('\n');
    }

    // Extract just the JSON object even if there is extra text around it
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    text = jsonMatch[0];

    return res.json(JSON.parse(text));
  } catch (err) {
    console.error('[extract]', err);
    return res.status(500).json({ error: err.message });
  }
}