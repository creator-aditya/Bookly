// Use lib/pdf-parse.js directly to skip the module's broken self-test.
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const AdmZip = require("adm-zip");

const KNOWN_CATEGORIES = [
  "Fiction",
  "Mystery",
  "Science Fiction",
  "Self-Help",
  "Finance",
  "Philosophy",
  "Technology",
  "Medical",
  "Kids",
  "Devotional",
  "Romance",
  "History",
  "Business"
];

function findAuthor(lines) {
  for (const line of lines.slice(0, 15)) {
    const m = line.match(/^by\s+(.+)/i);
    if (m) return m[1].trim();
  }
  return "";
}

function findDescription(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 100);

  return paragraphs[0] || "";
}

function guessCategory(text) {
  const lower = text.toLowerCase();
  for (const cat of KNOWN_CATEGORIES) {
    if (lower.includes(cat.toLowerCase())) return cat;
  }
  return "";
}

async function extractFromPdf(buffer) {
  const data = await pdfParse(buffer, { max: 10 });
  const info = data.info || {};
  const text = (data.text || "").trim();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    title: (info.Title || lines[0] || "").trim(),
    author: (info.Author || findAuthor(lines) || "").trim(),
    description: (info.Subject || findDescription(text) || "").trim(),
    category: guessCategory(text),
    genre: ""
  };
}

async function extractFromEpub(buffer) {
  const zip = new AdmZip(buffer);
  const containerXml = zip.readAsText("META-INF/container.xml");
  const opfPath = containerXml.match(/full-path="([^"]+)"/)?.[1];

  if (!opfPath) {
    throw new Error("Invalid EPUB: no OPF path.");
  }

  const opfXml = zip.readAsText(opfPath);

  const pick = (tag) => {
    const m = opfXml.match(
      new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)</dc:${tag}>`, "i")
    );
    return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
  };

  return {
    title: pick("title"),
    author: pick("creator"),
    description: pick("description"),
    category: pick("subject") || guessCategory(opfXml),
    genre: ""
  };
}

async function extractMetadata(buffer, fileType) {
  if (fileType === "PDF") return extractFromPdf(buffer);
  if (fileType === "EPUB") return extractFromEpub(buffer);
  throw new Error("Unsupported file type.");
}

module.exports = { extractMetadata };