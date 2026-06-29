import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};

const TOOL = {
  name: "extract_registration",
  description: "Extract fields from a vehicle registration document",
  input_schema: {
    type: "object",
    properties: {
      unit_number:           { type: ["string","null"], description: "Unit number or fleet number printed on the document" },
      type:                  { type: ["string","null"], description: "Registration type: return exactly 'Apportioned' if it is an apportioned/IRP registration, or 'Commercial' if it is a standard commercial registration" },
      plate:                 { type: ["string","null"], description: "License plate number" },
      year:                  { type: ["string","null"], description: "4-digit model year" },
      make:                  { type: ["string","null"], description: "Vehicle manufacturer e.g. FORD, FREIGHTLINER" },
      vin:                   { type: ["string","null"], description: "17-character Vehicle Identification Number" },
      gross_vehicle_weight:  { type: ["string","null"], description: "GVW / GVWR / GR VEHICLE WT / REG. GROSS WT" },
      gross_combined_weight: { type: ["string","null"], description: "GCW / GCWR / GR COMB WT / COMB. GROSS WT" },
      title_number:          { type: ["string","null"], description: "Title number or certificate number" },
      expiration_date:       { type: ["string","null"], description: "Expiration date MM/DD/YYYY" },
      state:                 { type: ["string","null"], description: "2-letter state abbreviation e.g. MD, PA, TX" },
    },
    required: ["unit_number","type","plate","year","make","vin","gross_vehicle_weight","gross_combined_weight","title_number","expiration_date","state"],
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { filename = "", base64, mimeType = "" } = req.body;
  if (!base64) return res.status(400).json({ error: "No file data received" });

  try {
    const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

    const fileBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image",    source: { type: "base64", media_type: mimeType || "image/jpeg", data: base64 } };

    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "extract_registration" },
      messages: [{ role: "user", content: [fileBlock, { type: "text", text: "Extract all vehicle registration fields from this document. Use null for any field not found." }] }],
    });

    const toolBlock = response.content.find((b) => b.type === "tool_use");
    if (!toolBlock) throw new Error("No tool_use block in response");

    console.log("[extract ok]", JSON.stringify(toolBlock.input));
    return res.json(toolBlock.input);
  } catch (err) {
    console.error("[extract fail]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
