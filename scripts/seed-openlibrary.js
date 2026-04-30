/* Seed MongoDB with booklist data fetched from Open Library Search API.
 *
 * Usage:
 *   MONGODB_URI="mongodb://localhost:27017/booklists" node scripts/seed-openlibrary.js
 *
 * Notes:
 * - Requires network access to openlibrary.org.
 * - Uses the MongoDB URI provided (defaults to localhost).
 * - Creates one booklist and inserts up to 500 items into `booklistitems`.
 */

// Prefer a local dependency when available; fall back to backend node_modules.
let MongoClient;
let ObjectId;
try {
  ({ MongoClient, ObjectId } = require('mongodb'));
} catch (err) {
  ({ MongoClient, ObjectId } = require('../backend/node_modules/mongodb'));
}
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

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/booklists';
const ownerId = process.env.BOOKLIST_OWNER_ID || 'OpenLibrary';
const booklistName = process.env.BOOKLIST_NAME || 'Open Library Fiction';
const booklistDescription =
  process.env.BOOKLIST_DESCRIPTION || 'Seeded from Open Library cover images';
const visibility = process.env.BOOKLIST_VISIBILITY || 'public';

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
    books.push({
      title,
      author,
      coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
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
  const dbName = client.db().databaseName || 'booklists';
  const db = client.db(dbName);
  const booklists = db.collection('booklists');
  const items = db.collection('booklistitems');

  const now = new Date();
  const booklistId = new ObjectId();
  const listDoc = {
    _id: booklistId,
    ownerId,
    name: booklistName,
    description: booklistDescription,
    visibility,
    coverUrl: books[0]?.coverUrl || undefined,
    totalItems: books.length,
    createdAt: now,
    updatedAt: now,
  };

  const itemDocs = books.map((book, index) => ({
    booklistId: booklistId.toString(),
    bookId: book.title,
    addedById: ownerId,
    position: index,
    notes: `${book.author} via Open Library`,
    coverUrl: book.coverUrl,
    addedAt: now,
  }));

  await booklists.deleteMany({ ownerId, name: booklistName });
  const listResult = await booklists.insertOne(listDoc);
  const itemResult = itemDocs.length
    ? await items.insertMany(itemDocs, { ordered: false })
    : { insertedCount: 0 };

  console.log(`Inserted booklist ${listResult.insertedId} into ${dbName}.booklists`);
  console.log(`Inserted ${itemResult.insertedCount} documents into ${dbName}.booklistitems`);

  await client.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
