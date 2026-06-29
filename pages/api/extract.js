import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `Extract the following fields from this vehicle registration document.
Different U.S. states use different label names — use your best judgment.

Return ONLY a valid JSON object with these exact keys (null if not found):

{
  "year": "4-digit model year (e.g. 2019)",
  "make": "vehicle manufacturer (e.g. FORD, FREIGHTLINER, KENWORTH)",
  "vin": "17-character Vehicle Identification Number",
  "gross_vehicle_weight": "Gross Vehicle Weight — look for: GVW, GVWR, GR VEHICLE WT, GROSS WT",
  "gross_combined_weight": "Gross Combined Weight — look for: GCW, GCWR, GR COMB WT, GROSS COMB",
  "title_number": "title number or certificate number",
  "expiration_date": "registration expiration date formatted MM/DD/YYYY",
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

    if (text.startsWith('```')) {
      const lines = text.split('\n');
      const end = lines[lines.length - 1].trim() === '```' ? lines.length - 1 : lines.length;
      text = lines.slice(1, end).join('\n');
    }

    return res.json(JSON.parse(text));
  } catch (err) {
    console.error('[extract]', err);
    return res.status(500).json({ error: err.message });
  }
}