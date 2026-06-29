import { google } from "googleapis";

const HEADERS = [
  "Filename", "Unit #", "Plate", "Year", "Make", "VIN",
  "Gross Vehicle Weight", "Gross Combined Weight",
  "Title Number", "Expiration Date", "State",
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { records } = req.body;
  if (!records?.length) return res.status(400).json({ error: "No records provided" });

  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = process.env.WORKSHEET_NAME || "Registrations";

    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:K1`,
    }).catch(() => ({ data: { values: null } }));

    const hasHeaders = existing.data.values?.[0]?.length > 0;

    const rows = records.map(r => [
      r.filename || "",
      r.unit_number || "",
      r.plate || "",
      r.year || "",
      r.make || "",
      r.vin || "",
      r.gross_vehicle_weight || "",
      r.gross_combined_weight || "",
      r.title_number || "",
      r.expiration_date || "",
      r.state || "",
    ]);

    if (!hasHeaders) rows.unshift(HEADERS);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: rows },
    });

    return res.json({ count: records.length });
  } catch (err) {
    console.error("[save]", err);
    return res.status(500).json({ error: err.message });
  }
}
