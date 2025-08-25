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

export async function GET(request) {
  try {
    const { db } = await connectToDatabase()
    
    // Get user's conversion history
    const userId = request.headers.get('x-user-id') || 'anonymous'
    const conversions = await db.collection('conversions')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray()

    return NextResponse.json({ conversions })
  } catch (error) {
    console.error('Conversions API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}