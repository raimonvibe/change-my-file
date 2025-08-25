// app/api/download/[fileId]/route.js
import { MongoClient, GridFSBucket, ObjectId } from 'mongodb'

export const runtime = 'nodejs'

let cachedClient = null
let cachedDb = null

async function connectToDatabase() {
  if (!process.env.MONGO_URL) throw new Error('MONGO_URL is not defined')
  if (!process.env.DB_NAME) throw new Error('DB_NAME is not defined')

  if (cachedClient && cachedDb) return { client: cachedClient, db: cachedDb }
  const client = new MongoClient(process.env.MONGO_URL)
  await client.connect()
  const db = client.db(process.env.DB_NAME)
  cachedClient = client
  cachedDb = db
  return { client, db }
}

export async function GET(_request, { params }) {
  try {
    const { db } = await connectToDatabase()
    const fileId = params.fileId // dit is jouw uuid uit 'conversions'

    // 1) Vind conversie-record op basis van uuid fileId
    const conversion = await db.collection('conversions').findOne({ fileId })
    if (!conversion || !conversion.gridFsId) {
      return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 })
    }

    // 2) Controleer/maak ObjectId van gridFsId
    const gridIdStr = String(conversion.gridFsId)
    if (!ObjectId.isValid(gridIdStr)) {
      return new Response(JSON.stringify({ error: 'Invalid GridFS id' }), { status: 400 })
    }
    const gridId = new ObjectId(gridIdStr)

    // 3) Haal metadata (mime/filename) uit GridFS
    const filesCol = db.collection('conversions.files') // standaard naam: <bucket>.files
    const fileDoc = await filesCol.findOne({ _id: gridId })
    if (!fileDoc) {
      return new Response(JSON.stringify({ error: 'File not found' }), { status: 404 })
    }

    const bucket = new GridFSBucket(db, { bucketName: 'conversions' })
    const stream = bucket.openDownloadStream(gridId)

    const mime =
      (fileDoc.metadata && fileDoc.metadata.mime) ||
      'application/octet-stream'
    const filename =
      fileDoc.filename ||
      conversion.outputFilename ||
      'download'

    // 4) Download teller ophogen (best effort)
    db.collection('conversions')
      .updateOne({ fileId }, { $inc: { downloadCount: 1 } })
      .catch(() => {})

    return new Response(stream, {
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('Download API Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}
