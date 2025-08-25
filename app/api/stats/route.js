import { NextResponse } from 'next/server'
import { MongoClient } from 'mongodb'

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

export async function GET() {
  try {
    const { db } = await connectToDatabase()
    
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
  } catch (error) {
    console.error('Stats API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}