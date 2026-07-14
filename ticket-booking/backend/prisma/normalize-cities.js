const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const venues = await prisma.venue.findMany();
  for (const v of venues) {
    const lower = v.city.toLowerCase();
    if (v.city !== lower) {
      await prisma.venue.update({ where: { id: v.id }, data: { city: lower } });
      console.log(`Updated: ${v.name} — "${v.city}" → "${lower}"`);
    }
  }
  console.log('Done');
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
