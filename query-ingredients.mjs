const Database = require('better-sqlite3');
const db = new Database('./data/pantry.db');
const rows = db.prepare('SELECT i.id, i.name, i.category, i.default_unit, GROUP_CONCAT(a.alias, "|") as aliases FROM ingredients i LEFT JOIN ingredient_aliases a ON a.ingredient_id = i.id GROUP BY i.id ORDER BY i.name').all();
for (const r of rows) console.log(JSON.stringify(r));
