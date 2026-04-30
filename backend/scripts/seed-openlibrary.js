/* Seed MongoDB with book reviews fetched from Open Library Search API.
 *
 * Usage:
 *   MONGODB_URI="mongodb://localhost:27017/socialbook" node scripts/seed-openlibrary.js
 *
 * Notes:
 * - Requires network access to openlibrary.org.
 * - Uses the MongoDB URI provided (defaults to localhost).
 * - Inserts up to 500 review documents into the `reviews` collection.
 */

const { MongoClient } = require('mongodb');
const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          try {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            resolve(json);
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

const LIMIT = 500;
const QUERY = 'subject:fiction'; // broad query to gather many ISBNs
const SEARCH_URL = `https://openlibrary.org/search.json?q=${encodeURIComponent(
  QUERY,
)}&limit=${LIMIT}&fields=title,author_name,isbn`;
const MIN_COVER_BYTES = Number(process.env.COVER_MIN_BYTES || 2048);
const COVER_TIMEOUT_MS = Number(process.env.COVER_TIMEOUT_MS || 5000);

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/socialbook';

function probeCover(url) {
  return new Promise((resolve) => {
    const request = https.get(
      url,
      {
        headers: { Range: `bytes=0-${MIN_COVER_BYTES - 1}` },
      },
      (res) => {
        const contentType = String(res.headers['content-type'] || '').toLowerCase();
        const contentLength = Number(res.headers['content-length'] || 0);

        if (!contentType.startsWith('image/') || contentType.includes('image/gif')) {
          res.resume();
          resolve(false);
          return;
        }

        if (Number.isFinite(contentLength) && contentLength >= MIN_COVER_BYTES) {
          res.resume();
          resolve(true);
          return;
        }

        const chunks = [];
        let total = 0;
        res.on('data', (chunk) => {
          chunks.push(chunk);
          total += chunk.length;
          if (total >= MIN_COVER_BYTES) {
            request.destroy();
            resolve(true);
          }
        });
        res.on('end', () => resolve(total >= MIN_COVER_BYTES));
      },
    );

    request.setTimeout(COVER_TIMEOUT_MS, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function fetchBooks() {
  const data = await fetchJson(SEARCH_URL);
  const docs = Array.isArray(data.docs) ? data.docs : [];

  const seen = new Set();
  const books = [];

  for (const doc of docs) {
    if (!doc?.isbn?.length) continue;
    const isbn = doc.isbn.find((code) => typeof code === 'string' && code.length >= 10);
    if (!isbn || seen.has(isbn)) continue;
    seen.add(isbn);

    const title = doc.title || 'Unknown title';
    const author = Array.isArray(doc.author_name) && doc.author_name.length > 0 ? doc.author_name[0] : 'Unknown author';
    const rating = Number((3 + Math.random() * 2).toFixed(1)); // 3.0–5.0
    const created = new Date().toISOString();

    const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    const coverOk = await probeCover(coverUrl);
    if (!coverOk) continue;

    books.push({
      user: 'OpenLibrary',
      book: title,
      rating,
      review: `${author} via Open Library`,
      genre: 'OpenLibrary',
      status: 'finished',
      created_at: created,
      coverUrl,
    });

    if (books.length >= LIMIT) break;
  }

  return books;
}

async function seed() {
  console.log(`Fetching up to ${LIMIT} books from Open Library...`);
  const books = await fetchBooks();
  console.log(`Fetched ${books.length} books with ISBNs.`);

  const client = new MongoClient(uri);
  await client.connect();
  const dbName = client.db().databaseName || 'socialbook';
  const db = client.db(dbName);
  const collection = db.collection('reviews');

  const result = await collection.insertMany(books, { ordered: false });
  console.log(`Inserted ${result.insertedCount} documents into ${dbName}.reviews`);

  await client.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
