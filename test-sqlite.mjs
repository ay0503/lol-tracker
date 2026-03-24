import { createClient } from '@libsql/client';
const client = createClient({ url: 'file:test.db' });
await client.execute('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)');
await client.execute("INSERT INTO test VALUES (1, 'hello')");
const result = await client.execute('SELECT * FROM test');
console.log('SQLite works:', result.rows);
client.close();
// cleanup
import { unlinkSync } from 'fs';
unlinkSync('test.db');
console.log('Done');
