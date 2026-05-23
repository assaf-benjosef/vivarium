---
name: managing-databases
description: >-
  Guides setting up and managing SQLite databases for Vivarium apps.
  Covers creating databases, recommended Node.js and Python patterns,
  and backup considerations. Use when the user's app needs data persistence,
  a database, or when working with SQLite.
---

# Managing Databases

SQLite is pre-installed and recommended for all Vivarium apps.
No setup needed — just create a .db file.

## Node.js (recommended)

Install: `npm install better-sqlite3`

```javascript
const Database = require('better-sqlite3');
const db = new Database('/workspace/data.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert
const insert = db.prepare('INSERT INTO items (name) VALUES (?)');
insert.run('My item');

// Query
const items = db.prepare('SELECT * FROM items').all();
```

## Python

```python
import sqlite3
conn = sqlite3.connect('/workspace/data.db')
cursor = conn.cursor()
cursor.execute('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)')
conn.commit()
```

## CLI
```
sqlite3 /workspace/data.db ".tables"
sqlite3 /workspace/data.db "SELECT * FROM items"
```

## Important
- Always store .db files in /workspace (not /tmp)
- Use WAL mode for better concurrency: `PRAGMA journal_mode=WAL;`
- Database files are included in git snapshots automatically
- Database files can get large — don't forget `.gitignore` for temp files
