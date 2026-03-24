/**
 * Seed script: Populate priceHistory table with historical LP data
 * so that ETF compounding produces different prices for leveraged/inverse tickers.
 *
 * Uses the same LP waypoints and totalLPToPrice logic as the frontend playerData.ts.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

function totalLPToPrice(totalLP) {
  const maxLP = 1200;
  const minPrice = 10;
  const maxPrice = 100;
  const clampedLP = Math.max(0, Math.min(totalLP, maxLP));
  return minPrice + (clampedLP / maxLP) * (maxPrice - minPrice);
}

function totalLPToTierInfo(totalLP) {
  // Platinum: 0-399, Emerald: 400-799, Diamond: 800-1200
  const tiers = [
    { name: "PLATINUM", min: 0, max: 399 },
    { name: "EMERALD", min: 400, max: 799 },
    { name: "DIAMOND", min: 800, max: 1200 },
  ];
  const divs = ["IV", "III", "II", "I"];

  for (const t of tiers) {
    if (totalLP >= t.min && totalLP <= t.max) {
      const inTier = totalLP - t.min;
      const divIdx = Math.min(Math.floor(inTier / 100), 3);
      const lp = inTier % 100;
      return { tier: t.name, division: divs[divIdx], lp };
    }
  }
  // Fallback: Diamond I
  return { tier: "DIAMOND", division: "I", lp: Math.min(totalLP - 1100, 100) };
}

// Generate the same extended history as the frontend
function generateHistory() {
  const points = [];

  // Extended history: Sep 23, 2025 → Mar 10, 2026
  const startDate = new Date(2025, 8, 23); // Sep 23, 2025
  const endDate = new Date(2026, 2, 10);   // Mar 10, 2026
  const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  const waypoints = [
    { day: 0, totalLP: 409 },
    { day: 30, totalLP: 380 },
    { day: 60, totalLP: 420 },
    { day: 90, totalLP: 350 },
    { day: 110, totalLP: 400 },
    { day: 130, totalLP: 440 },
    { day: 150, totalLP: 420 },
    { day: 165, totalLP: 450 },
    { day: totalDays, totalLP: 460 },
  ];

  // Use a seeded random to match frontend (we'll use sin/cos noise like frontend)
  for (let day = 0; day <= totalDays; day++) {
    let prevWP = waypoints[0];
    let nextWP = waypoints[1];
    for (let i = 0; i < waypoints.length - 1; i++) {
      if (day >= waypoints[i].day && day <= waypoints[i + 1].day) {
        prevWP = waypoints[i];
        nextWP = waypoints[i + 1];
        break;
      }
    }

    const progress = (day - prevWP.day) / (nextWP.day - prevWP.day || 1);
    const baseTotalLP = prevWP.totalLP + (nextWP.totalLP - prevWP.totalLP) * progress;
    // Use deterministic noise (same as frontend but without Math.random)
    const noise = Math.sin(day * 0.7) * 15 + Math.cos(day * 1.3) * 10;
    const totalLP = Math.max(0, Math.round(baseTotalLP + noise));

    const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
    const timestamp = currentDate.getTime();
    const price = totalLPToPrice(totalLP);
    const tierInfo = totalLPToTierInfo(totalLP);

    points.push({
      timestamp,
      tier: tierInfo.tier,
      division: tierInfo.division,
      lp: tierInfo.lp,
      totalLP,
      price: price.toFixed(4),
    });
  }

  // Real recent data: Mar 11 - Mar 23
  const recentData = [
    { date: "2026-03-11", tier: "EMERALD", division: "IV", lp: 60, totalLP: 460 },
    { date: "2026-03-12", tier: "EMERALD", division: "IV", lp: 84, totalLP: 484 },
    { date: "2026-03-13", tier: "EMERALD", division: "IV", lp: 85, totalLP: 485 },
    { date: "2026-03-14", tier: "EMERALD", division: "III", lp: 25, totalLP: 525 },
    { date: "2026-03-15", tier: "EMERALD", division: "III", lp: 45, totalLP: 545 },
    { date: "2026-03-16", tier: "EMERALD", division: "IV", lp: 61, totalLP: 461 },
    { date: "2026-03-17", tier: "EMERALD", division: "III", lp: 43, totalLP: 543 },
    { date: "2026-03-18", tier: "EMERALD", division: "III", lp: 63, totalLP: 563 },
    { date: "2026-03-19", tier: "EMERALD", division: "II", lp: 3, totalLP: 603 },
    { date: "2026-03-20", tier: "EMERALD", division: "III", lp: 63, totalLP: 563 },
    { date: "2026-03-21", tier: "EMERALD", division: "III", lp: 33, totalLP: 533 },
    { date: "2026-03-22", tier: "EMERALD", division: "III", lp: 73, totalLP: 573 },
    { date: "2026-03-23", tier: "EMERALD", division: "II", lp: 39, totalLP: 639 },
  ];

  for (const d of recentData) {
    const timestamp = new Date(d.date).getTime() + 12 * 60 * 60 * 1000; // noon
    const price = totalLPToPrice(d.totalLP);
    points.push({
      timestamp,
      tier: d.tier,
      division: d.division,
      lp: d.lp,
      totalLP: d.totalLP,
      price: price.toFixed(4),
    });
  }

  return points;
}

async function main() {
  console.log("Connecting to database...");
  const connection = await mysql.createConnection(DATABASE_URL);

  // Check existing count
  const [rows] = await connection.execute("SELECT COUNT(*) as cnt FROM priceHistory");
  const existingCount = rows[0].cnt;
  console.log(`Existing price history records: ${existingCount}`);

  // Delete existing records that are all the same price (today's polling data)
  // We'll keep them and just add historical data before them
  const [minTs] = await connection.execute("SELECT MIN(timestamp) as minTs FROM priceHistory");
  const earliestExisting = minTs[0].minTs;

  const history = generateHistory();
  console.log(`Generated ${history.length} historical data points`);

  // Only insert points that are before the earliest existing record
  const toInsert = earliestExisting
    ? history.filter(p => p.timestamp < Number(earliestExisting))
    : history;

  console.log(`Inserting ${toInsert.length} new historical price snapshots...`);

  if (toInsert.length === 0) {
    console.log("No new data to insert. All historical data already exists.");
    await connection.end();
    return;
  }

  // Batch insert
  const batchSize = 50;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    const values = batch.map(p =>
      `(${p.timestamp}, '${p.tier}', '${p.division}', ${p.lp}, ${p.totalLP}, ${p.price})`
    ).join(",\n");

    await connection.execute(
      `INSERT INTO priceHistory (timestamp, tier, division, lp, totalLP, price) VALUES ${values}`
    );
    console.log(`  Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toInsert.length / batchSize)}`);
  }

  // Verify
  const [countResult] = await connection.execute("SELECT COUNT(*) as cnt FROM priceHistory");
  console.log(`Total price history records after seeding: ${countResult[0].cnt}`);

  // Check ETF price variation
  const [priceRange] = await connection.execute(
    "SELECT MIN(price) as min_price, MAX(price) as max_price FROM priceHistory"
  );
  console.log(`Price range: $${priceRange[0].min_price} - $${priceRange[0].max_price}`);

  await connection.end();
  console.log("Done! ETF prices should now show different values for each ticker.");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
