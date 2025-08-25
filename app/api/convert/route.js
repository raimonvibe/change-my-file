// app/api/convert/route.ts
import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { createWriteStream, promises as fsp } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'

let cachedClient = null

async function connectToDatabase() {
  if (cachedClient) {
    return { client: cachedClient, db: cachedClient.db(process.env.DB_NAME) }
  }
  const client = new MongoClient(process.env.MONGO_URL as string)
  await client.connect()
  cachedClient = client
  return { client, db: client.db(process.env.DB_NAME) }
}

async function streamFileToTmp(file: File, destPath: string) {
  await fsp.mkdir(path.dirname(destPath), { recursive: true })
  const readable = file.stream() as unknown as NodeJS.ReadableStream
  const writable = createWriteStream(destPath)
  await pipeline(readable, writable)
}

async function convertDocxToTxt(filePath: string) {
  const result = await mammoth.extractRawText({ path: filePath })
  return result.value
}

async function convertPdfToTxt(filePath: string) {
  const dataBuffer = await fsp.readFile(filePath)
  const data = await pdfParse(dataBuffer as unknown as Buffer)
  return data.text
}

export async function POST(request: Request) {
  try {
    const { db } = await connectToDatabase()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const conversionType = String(formData.get('conversionType') || '')
    const userId = String(formData.get('userId') || 'anonymous')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
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

    // Stream naar /tmp (RAM-vriendelijk)
    await streamFileToTmp(file, inputPath)

    let outputText = ''
    let outputFilename = ''
    let outputExt = '.txt'

    switch (conversionType) {
      case 'docx-to-txt':
        if (ext !== '.docx') throw new Error('Invalid file type for DOCX to TXT conversion')
        outputText = await convertDocxToTxt(inputPath)
        outputFilename = originalName.replace(/\.docx$/i, '.txt')
        break
      case 'pdf-to-txt':
        if (ext !== '.pdf') throw new Error('Invalid file type for PDF to TXT conversion')
        outputText = await convertPdfToTxt(inputPath)
        outputFilename = originalName.replace(/\.pdf$/i, '.txt')
        break
      case 'txt-to-pdf':
        if (ext !== '.txt') throw new Error('Invalid file type for TXT to PDF conversion')
        // Placeholder: we geven de tekst terug en noemen het .pdf voor nu
        outputText = await fsp.readFile(inputPath, 'utf-8')
        outputFilename = originalName.replace(/\.txt$/i, '.pdf')
        outputExt = '.pdf'
        break
    }

    const outPath = path.join(convertedDir, `${fileId}${outputExt}`)
    await fsp.writeFile(outPath, outputText, outputExt === '.txt' ? 'utf-8' : undefined)

    // Persistente download-URL regelen
    let downloadUrl: string | null = null
    try {
      // Vercel Blob (zet BLOB_READ_WRITE_TOKEN als env var in Vercel)
      const blobRes = await put(`conversions/${fileId}${outputExt}`, await fsp.readFile(outPath), {
        access: 'public',
        contentType: outputExt === '.txt' ? 'text/plain; charset=utf-8' : 'application/pdf',
      })
      downloadUrl = blobRes.url
    } catch {
      // Fallback: stuur inline base64 terug (niet ideaal, maar werkt zonder blob storage)
      const outBuf = await fsp.readFile(outPath)
      const b64 = outBuf.toString('base64')
      downloadUrl = `data:${outputExt === '.txt' ? 'text/plain' : 'application/pdf'};base64,${b64}`
    }

    const stat = await fsp.stat(inputPath).catch(() => ({ size: 0 } as any))

    const record = {
      fileId,
      userId,
      originalFilename: originalName,
      outputFilename,
      conversionType,
      status: 'completed' as const,
      storage: downloadUrl?.startsWith('http') ? 'vercel-blob' : 'inline',
      downloadUrl,
      inputSize: stat.size || (file as any).size || null,
      createdAt: new Date(),
      downloadCount: 0,
    }
    await db.collection('conversions').insertOne(record)

    // Opruimen van /tmp
    await Promise.allSettled([fsp.unlink(inputPath), fsp.unlink(outPath)])

    return NextResponse.json({
      success: true,
      fileId,
      conversionType,
      outputFilename,
      downloadUrl,
    })
  } catch (err: any) {
    console.error('Convert API Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
