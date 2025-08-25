import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import fs from 'fs/promises'

let cachedClient = null
let cachedDb = null

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb }
  }

  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  cachedClient = client
  cachedDb = db

  return { client, db }
}

export async function GET(request, { params }) {
  try {
    const { db } = await connectToDatabase()
    const fileId = params.fileId
    
    // Find the conversion record
    const conversion = await db.collection('conversions').findOne({ fileId })
    
    if (!conversion || !conversion.outputPath) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    try {
      // Read the converted file
      const fileBuffer = await fs.readFile(conversion.outputPath)
      const filename = conversion.outputFilename || 'converted_file'
      
      // Increment download count
      await db.collection('conversions').updateOne(
        { fileId },
        { $inc: { downloadCount: 1 } }
      )
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`
        }
      })
    } catch (fileError) {
      console.error('File read error:', fileError)
      return NextResponse.json({ error: 'File not accessible' }, { status: 404 })
    }
  } catch (error) {
    console.error('Download API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}