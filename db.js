const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'prices.db'));

function initDB() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_name TEXT NOT NULL,
      grade TEXT NOT NULL,
      price REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  });
}

function insertPrice(card_name, grade, price) {
  db.run(
    `INSERT INTO prices (card_name, grade, price) VALUES (?, ?, ?)`,
    [card_name, grade, price]
  );
}

function getPriceHistory(card_name, grade, limit = 24, callback) {
  db.all(
    `SELECT price, timestamp FROM prices WHERE card_name = ? AND grade = ? ORDER BY timestamp DESC LIMIT ?`,
    [card_name, grade, limit],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows.reverse()); // reverse for chronological order
    }
  );
}

module.exports = {
  db,
  initDB,
  insertPrice,
  getPriceHistory
}; 