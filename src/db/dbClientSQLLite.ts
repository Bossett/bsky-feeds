import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';
import { InvalidRequestError } from '@atproto/xrpc-server';

dotenv.config();

class DbSingleton {
  db;

  constructor(dbPath) {
    this.init(dbPath);
  }

  async init(dbPath) {
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  }

  async deleteManyURI(collection, uris) {
    await this.db.run(`DELETE FROM ${collection} WHERE uri IN (?)`, uris);
  }

  async deleteManyDID(collection, dids) {
    await this.db.run(`DELETE FROM ${collection} WHERE did IN (?)`, dids);
  }

  async replaceOneURI(collection, uri, data) {
    if (!(typeof data._id === typeof '')) data._id = data._id || generateObjectId();

    try {
      await this.db.run(`INSERT INTO ${collection} VALUES (?, ?)`, data._id, JSON.stringify(data));
    } catch (err) {
      await this.db.run(`UPDATE ${collection} SET data = ? WHERE uri = ?`, JSON.stringify(data), uri);
    }
  }

  async replaceOneDID(collection, did, data) {
    if (!(typeof data._id === typeof '')) data._id = data._id || generateObjectId();

    try {
      await this.db.run(`INSERT INTO ${collection} VALUES (?, ?)`, data._id, JSON.stringify(data));
    } catch (err) {
      await this.db.run(`UPDATE ${collection} SET data = ? WHERE did = ?`, JSON.stringify(data), did);
    }
  }

  async getPostBySortWeight(collection, limit = 50, cursor) {
    let start = 0;

    if (cursor !== undefined) {
      start = parseInt(cursor, 10);
    }

    const posts = await this.db.all(
      `SELECT * FROM ${collection} ORDER BY sort_weight DESC LIMIT ? OFFSET ?`,
      limit,
      start
    );

    return posts || [];
  }

  // ... (continue converting other methods)

  async getPostForURI(uri) {
    const result = await this.db.get(`SELECT * FROM post WHERE uri = ?`, uri);

    return result || null;
  }
}

function generateObjectId() {
  // Implement your own logic to generate a unique identifier (similar to MongoDB ObjectId)
  // For simplicity, you can use a UUID or any other unique identifier generation method.
  // Make sure it's unique across your dataset.
  return 'generatedObjectId';
}

const dbClient = new DbSingleton('path/to/your/sqlite/database.db');
export default dbClient;
