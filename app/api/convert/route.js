// app/api/convert/route.js
import { NextResponse } from 'next/server'
import { MongoClient, GridFSBucket } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { createWriteStream, promises as fsp } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import path from 'node:path'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

export const runtime = 'nodejs'

let cachedClient = null

async function connectToDatabase() {
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is not defined')
  if (!process.env.DB_NAME) throw new Error('DB_NAME is not defined')

  if (cachedClient) return { client: cachedClient, db: cachedClient.db(process.env.DB_NAME) }
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  cachedClient = client
  return { client, db: client.db(process.env.DB_NAME) }
}

async function streamFileToTmp(file, destPath) {
  await fsp.mkdir(path.dirname(destPath), { recursive: true })
  const readable = Readable.fromWeb(file.stream()) // Web → Node stream
  const writable = createWriteStream(destPath)
  await pipeline(readable, writable)
}

async function convertDocxToTxt(filePath) {
  const result = await mammoth.extractRawText({ path: filePath })
  return result.value
}

async function convertPdfToTxt(filePath) {
  const dataBuffer = await fsp.readFile(filePath)
  const data = await pdfParse(dataBuffer)
  return data.text
}

async function uploadBufferToGridFS(db, buffer, filename, mime, metadata = {}) {
  const bucket = new GridFSBucket(db, { bucketName: 'conversions' })
  const uploadStream = bucket.openUploadStream(filename, {
    metadata: { ...metadata, mime },
  })
  await new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(uploadStream)
      .on('error', reject)
      .on('finish', resolve)
  })
  // Het _id van het GridFS-bestand
  return uploadStream.id
}

export async function POST(request) {
  try {
    const { db } = await connectToDatabase()

    const formData = await request.formData()
    const file = formData.get('file')
    const conversionType = String(formData.get('conversionType') || '')
    const userId = String(formData.get('userId') || 'anonymous')

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!['docx-to-txt', 'pdf-to-txt', 'txt-to-pdf'].includes(conversionType)) {
      return NextResponse.json({ error: 'Unsupported conversion type' }, { status: 400 })
    }

    const fileId = uuidv4()
    const uploadDir = '/tmp/uploads'
    const convertedDir = '/tmp/converted'
    await fsp.mkdir(uploadDir, { recursive: true })
    await fsp.mkdir(convertedDir, { recursive: true })

    const originalName = file.name || 'upload'
    const ext = path.extname(originalName).toLowerCase()
    const inputPath = path.join(uploadDir, `${fileId}${ext}`)

    // RAM-vriendelijk streamen naar /tmp
    await streamFileToTmp(file, inputPath)

    let outputText = ''
    let outputFilename = ''
    let outputExt = '.txt'
    let outputMime = 'text/plain; charset=utf-8'

    if (conversionType === 'docx-to-txt') {
      if (ext !== '.docx') throw new Error('Invalid file type for DOCX to TXT conversion')
      outputText = await convertDocxToTxt(inputPath)
      outputFilename = originalName.replace(/\.docx$/i, '.txt')
    } else if (conversionType === 'pdf-to-txt') {
      if (ext !== '.pdf') throw new Error('Invalid file type for PDF to TXT conversion')
      outputText = await convertPdfToTxt(inputPath)
      outputFilename = originalName.replace(/\.pdf$/i, '.txt')
    } else if (conversionType === 'txt-to-pdf') {
      if (ext !== '.txt') throw new Error('Invalid file type for TXT to PDF conversion')
      // Placeholder: je levert “pdf” als tekstinhoud; voor echte PDF straks een lib gebruiken
      outputText = await fsp.readFile(inputPath, 'utf-8')
      outputFilename = originalName.replace(/\.txt$/i, '.pdf')
      outputExt = '.pdf'
      outputMime = 'application/pdf'
    }

    const outPath = path.join(convertedDir, `${fileId}${outputExt}`)
    await fsp.writeFile(outPath, outputText, outputExt === '.txt' ? 'utf-8' : undefined)

    // Upload het resultaat naar GridFS (persistente opslag)
    const gridBuffer = outputExt === '.txt'
      ? Buffer.from(outputText, 'utf-8')
      : await fsp.readFile(outPath) // placeholder PDF
    const gridId = await uploadBufferToGridFS(
      db,
      gridBuffer,
      outputFilename,
      outputMime,
      { originalFilename: originalName, ownerUserId: userId, conversionType }
    )

    const downloadUrl = `/api/download/${gridId.toString()}`

    // Bewaar record (handig voor audit/logs)
    const stat = await fsp.stat(inputPath).catch(() => ({ size: null }))
    await db.collection('conversions').insertOne({
      fileId,
      userId,
      originalFilename: originalName,
      outputFilename,
      conversionType,
      status: 'completed',
      storage: 'gridfs',
      gridFsId: gridId,
      downloadUrl,
      inputSize: stat.size,
      createdAt: new Date(),
      downloadCount: 0,
    })

    // Opruimen
    await Promise.allSettled([fsp.unlink(inputPath), fsp.unlink(outPath)])

    return NextResponse.json({
      success: true,
      fileId,
      conversionType,
      outputFilename,
      downloadUrl,
    })
  } catch (err) {
    console.error('Convert API Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
