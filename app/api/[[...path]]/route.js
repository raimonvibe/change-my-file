import { NextRequest, NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

// MongoDB connection
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

// File conversion functions
async function convertDocxToTxt(filePath) {
  try {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  } catch (error) {
    throw new Error('Failed to convert DOCX to TXT: ' + error.message)
  }
}

async function convertPdfToTxt(filePath) {
  try {
    const dataBuffer = await fs.readFile(filePath)
    const data = await pdfParse(dataBuffer)
    return data.text
  } catch (error) {
    throw new Error('Failed to convert PDF to TXT: ' + error.message)
  }
}

// API Routes Handler
export async function GET(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '')

  console.log('GET request - pathname:', pathname, 'path:', path)

  try {
    const { db } = await connectToDatabase()

    if (path === '/stats') {
    if (path === '/conversions') {
      // Get user's conversion history
      const userId = request.headers.get('x-user-id') || 'anonymous'
      const conversions = await db.collection('conversions')
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray()

      return NextResponse.json({ conversions })
    }

    if (path.startsWith('/download/')) {
      // Download converted file
      const fileId = path.split('/download/')[1]
      const conversion = await db.collection('conversions').findOne({ fileId })
      
      if (!conversion || !conversion.outputPath) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      try {
        const fileBuffer = await fs.readFile(conversion.outputPath)
        const filename = conversion.outputFilename || 'converted_file'
        
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        })
      } catch (error) {
        return NextResponse.json({ error: 'File not accessible' }, { status: 404 })
      }
    }

    if (path === '/stats') {
      // Get conversion statistics
      const stats = await db.collection('conversions').aggregate([
        {
          $group: {
            _id: '$conversionType',
            count: { $sum: 1 }
          }
        }
      ]).toArray()

      const totalConversions = await db.collection('conversions').countDocuments()

      return NextResponse.json({ stats, totalConversions })
    }

    return NextResponse.json({ message: 'API endpoint not found' }, { status: 404 })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '')

  try {
    const { db } = await connectToDatabase()

    if (path === '/convert') {
      // Handle file conversion
      const formData = await request.formData()
      const file = formData.get('file')
      const conversionType = formData.get('conversionType')
      const userId = formData.get('userId') || 'anonymous'

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }

      // Save uploaded file
      const fileId = uuidv4()
      const uploadDir = '/tmp/uploads'
      const convertedDir = '/tmp/converted'
      
      // Ensure directories exist
      await fs.mkdir(uploadDir, { recursive: true })
      await fs.mkdir(convertedDir, { recursive: true })

      const fileName = file.name
      const fileExtension = path.extname(fileName).toLowerCase()
      const filePath = path.join(uploadDir, `${fileId}${fileExtension}`)

      // Write file to disk
      const bytes = await file.arrayBuffer()
      await fs.writeFile(filePath, Buffer.from(bytes))

      let outputPath = null
      let outputFilename = null
      let conversionResult = null

      try {
        // Perform conversion based on type
        switch (conversionType) {
          case 'docx-to-txt':
            if (fileExtension !== '.docx') {
              throw new Error('Invalid file type for DOCX to TXT conversion')
            }
            conversionResult = await convertDocxToTxt(filePath)
            outputFilename = fileName.replace('.docx', '.txt')
            outputPath = path.join(convertedDir, `${fileId}.txt`)
            await fs.writeFile(outputPath, conversionResult)
            break

          case 'pdf-to-txt':
            if (fileExtension !== '.pdf') {
              throw new Error('Invalid file type for PDF to TXT conversion')
            }
            conversionResult = await convertPdfToTxt(filePath)
            outputFilename = fileName.replace('.pdf', '.txt')
            outputPath = path.join(convertedDir, `${fileId}.txt`)
            await fs.writeFile(outputPath, conversionResult)
            break

          case 'pdf-to-images':
            // Temporarily disabled due to dependency issues
            throw new Error('PDF to Images conversion temporarily unavailable')

          case 'txt-to-pdf':
            // For now, return the text content (would need additional PDF generation library)
            if (fileExtension !== '.txt') {
              throw new Error('Invalid file type for TXT to PDF conversion')
            }
            const txtContent = await fs.readFile(filePath, 'utf-8')
            conversionResult = txtContent
            outputFilename = fileName.replace('.txt', '.pdf')
            outputPath = path.join(convertedDir, `${fileId}.txt`) // Placeholder
            await fs.writeFile(outputPath, conversionResult)
            break

          default:
            throw new Error('Unsupported conversion type')
        }

        // Save conversion record to database
        const conversionRecord = {
          fileId,
          userId,
          originalFilename: fileName,
          outputFilename,
          conversionType,
          status: 'completed',
          outputPath,
          fileSize: bytes.byteLength,
          createdAt: new Date(),
          downloadCount: 0
        }

        await db.collection('conversions').insertOne(conversionRecord)

        // Clean up uploaded file
        await fs.unlink(filePath)

        return NextResponse.json({
          success: true,
          fileId,
          downloadUrl: `/api/download/${fileId}`,
          conversionType,
          outputFilename
        })

      } catch (conversionError) {
        // Clean up files on error
        try {
          await fs.unlink(filePath)
          if (outputPath) await fs.unlink(outputPath)
        } catch (cleanupError) {
          console.error('Cleanup error:', cleanupError)
        }

        // Save failed conversion record
        await db.collection('conversions').insertOne({
          fileId,
          userId,
          originalFilename: fileName,
          conversionType,
          status: 'failed',
          error: conversionError.message,
          createdAt: new Date()
        })

        return NextResponse.json({ 
          error: conversionError.message 
        }, { status: 400 })
      }
    }

    if (path === '/users') {
      // Create or update user
      const body = await request.json()
      const { email, name, provider } = body

      const user = await db.collection('users').findOneAndUpdate(
        { email },
        { 
          $set: { name, provider, lastLogin: new Date() },
          $setOnInsert: { 
            createdAt: new Date(),
            conversionsUsed: 0,
            plan: 'free'
          }
        },
        { upsert: true, returnDocument: 'after' }
      )

      return NextResponse.json({ user: user.value })
    }

    return NextResponse.json({ message: 'API endpoint not found' }, { status: 404 })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '')

  try {
    const { db } = await connectToDatabase()

    if (path.startsWith('/conversions/')) {
      // Update conversion (e.g., increment download count)
      const fileId = path.split('/conversions/')[1]
      
      await db.collection('conversions').updateOne(
        { fileId },
        { $inc: { downloadCount: 1 } }
      )

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ message: 'API endpoint not found' }, { status: 404 })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  const { pathname } = new URL(request.url)
  const path = pathname.replace('/api', '')

  try {
    const { db } = await connectToDatabase()

    if (path.startsWith('/conversions/')) {
      // Delete conversion record and file
      const fileId = path.split('/conversions/')[1]
      const conversion = await db.collection('conversions').findOne({ fileId })

      if (conversion && conversion.outputPath) {
        try {
          await fs.unlink(conversion.outputPath)
        } catch (error) {
          console.error('Error deleting file:', error)
        }
      }

      await db.collection('conversions').deleteOne({ fileId })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ message: 'API endpoint not found' }, { status: 404 })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}