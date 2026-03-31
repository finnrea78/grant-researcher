import { readFileSync } from 'fs';
import { Readable } from 'stream';

// A .docx is a zip file. We'll parse the zip manually to extract word/document.xml
const buf = readFileSync('/home/finn/Developer/grant-scout-v2/grant-researcher/core/data/researchers/anthony/raw/cv.docx');

// Find the end of central directory record
let eocdOffset = -1;
for (let i = buf.length - 22; i >= 0; i--) {
  if (buf.readUInt32LE(i) === 0x06054b50) {
    eocdOffset = i;
    break;
  }
}

const cdOffset = buf.readUInt32LE(eocdOffset + 16);
const cdSize = buf.readUInt32LE(eocdOffset + 12);
const cdEntries = buf.readUInt16LE(eocdOffset + 10);

// Parse central directory to find word/document.xml
let offset = cdOffset;
let localHeaderOffset = -1;

for (let i = 0; i < cdEntries; i++) {
  const sig = buf.readUInt32LE(offset);
  if (sig !== 0x02014b50) break;

  const fnLen = buf.readUInt16LE(offset + 28);
  const extraLen = buf.readUInt16LE(offset + 30);
  const commentLen = buf.readUInt16LE(offset + 32);
  const localOffset = buf.readUInt32LE(offset + 42);
  const fileName = buf.subarray(offset + 46, offset + 46 + fnLen).toString('utf-8');

  if (fileName === 'word/document.xml') {
    localHeaderOffset = localOffset;
    break;
  }

  offset += 46 + fnLen + extraLen + commentLen;
}

if (localHeaderOffset === -1) {
  console.error('word/document.xml not found in docx');
  process.exit(1);
}

// Read local file header
const lhSig = buf.readUInt32LE(localHeaderOffset);
const compressionMethod = buf.readUInt16LE(localHeaderOffset + 8);
const compressedSize = buf.readUInt32LE(localHeaderOffset + 18);
const uncompressedSize = buf.readUInt32LE(localHeaderOffset + 22);
const lhFnLen = buf.readUInt16LE(localHeaderOffset + 26);
const lhExtraLen = buf.readUInt16LE(localHeaderOffset + 28);

const dataOffset = localHeaderOffset + 30 + lhFnLen + lhExtraLen;
const compressedData = buf.subarray(dataOffset, dataOffset + compressedSize);

import { inflateRawSync } from 'zlib';

let xml;
if (compressionMethod === 0) {
  xml = compressedData.toString('utf-8');
} else {
  xml = inflateRawSync(compressedData).toString('utf-8');
}

// Extract text from XML: get content of <w:t> tags
const matches = xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g);
let currentParagraph = '';
let result = [];
let lastPos = 0;

// Split by paragraph markers
const parts = xml.split(/<\/w:p>/g);
for (const part of parts) {
  const textMatches = [...part.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
  if (textMatches.length > 0) {
    const line = textMatches.map(m => m[1]).join('');
    result.push(line);
  }
}

console.log(result.join('\n'));
