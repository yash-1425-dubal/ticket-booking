const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const dbUrl = (process.env.DATABASE_URL || '').replace(/[\?&]sslmode=[^&]+/g, '').replace(/[?&]$/, '');
const isExternal = dbUrl.includes('render.com');
const pool = new Pool({ connectionString: dbUrl, ssl: isExternal ? { rejectUnauthorized: false } : false });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Create users
  const adminPassword = await bcrypt.hash('admin123', 10);
  const organizerPassword = await bcrypt.hash('organizer123', 10);
  const customerPassword = await bcrypt.hash('customer123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@ticketbook.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@ticketbook.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });

  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@ticketbook.com' },
    update: {},
    create: {
      name: 'Organizer User',
      email: 'organizer@ticketbook.com',
      passwordHash: organizerPassword,
      role: 'ORGANIZER',
      isEmailVerified: true,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@ticketbook.com' },
    update: {},
    create: {
      name: 'Customer User',
      email: 'customer@ticketbook.com',
      passwordHash: customerPassword,
      role: 'CUSTOMER',
      isEmailVerified: true,
    },
  });

  console.log('Users created:', { admin: admin.email, organizer: organizer.email, customer: customer.email });

  // Create venues with Indian cities
  const venue1 = await prisma.venue.upsert({
    where: { id: 'venue-1' },
    update: {},
    create: {
      id: 'venue-1',
      name: 'PVR: Phoenix Marketcity',
      address: 'Phoenix Marketcity, Kurla West',
      city: 'Mumbai',
      totalRows: 10,
      seatsPerRow: 12,
    },
  });

  const venue2 = await prisma.venue.upsert({
    where: { id: 'venue-2' },
    update: {},
    create: {
      id: 'venue-2',
      name: 'INOX: Select Citywalk',
      address: 'Select Citywalk, Saket District Centre',
      city: 'Delhi',
      totalRows: 8,
      seatsPerRow: 10,
    },
  });

  const venue3 = await prisma.venue.upsert({
    where: { id: 'venue-3' },
    update: {},
    create: {
      id: 'venue-3',
      name: 'Cinepolis: Forum Mall',
      address: 'Forum Mall, Koramangala',
      city: 'Bengaluru',
      totalRows: 9,
      seatsPerRow: 11,
    },
  });

  const venue4 = await prisma.venue.upsert({
    where: { id: 'venue-4' },
    update: {},
    create: {
      id: 'venue-4',
      name: 'PVR: GVK One',
      address: 'GVK One, Banjara Hills',
      city: 'Hyderabad',
      totalRows: 7,
      seatsPerRow: 9,
    },
  });

  console.log('Venues created:', venue1.name, venue2.name, venue3.name, venue4.name);

  // Create movies
  const movie1 = await prisma.movie.create({
    data: {
      title: 'Summer Music Festival',
      description: 'An amazing summer music festival with top artists.',
      venueId: venue1.id,
      organizerId: organizer.id,
      status: 'PUBLISHED',
      category: 'CONCERT',
    },
  });

  const movie2 = await prisma.movie.create({
    data: {
      title: 'Broadway: The Phantom of the Opera',
      description: 'The classic musical performed live.',
      venueId: venue2.id,
      organizerId: organizer.id,
      status: 'PUBLISHED',
      category: 'THEATRE',
    },
  });

  const movie3 = await prisma.movie.create({
    data: {
      title: 'Karan Aujla - Diljit Dosanjh Live',
      description: 'Punjabi music concert featuring top artists.',
      venueId: venue3.id,
      organizerId: organizer.id,
      status: 'PUBLISHED',
      category: 'CONCERT',
    },
  });

  const movie4 = await prisma.movie.create({
    data: {
      title: 'Pushpa 2 - The Rule (3D)',
      description: 'Blockbuster movie screening in 3D.',
      venueId: venue4.id,
      organizerId: organizer.id,
      status: 'PUBLISHED',
      category: 'MOVIE',
    },
  });

  console.log('Movies created:', movie1.title, movie2.title, movie3.title, movie4.title);

  // Create events (screenings) with auto-generated seats
  const eventDates = [
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  ];

  const movieVenueMap = [
    { movie: movie1, venue: venue1 },
    { movie: movie2, venue: venue2 },
    { movie: movie3, venue: venue3 },
    { movie: movie4, venue: venue4 },
  ];

  for (const { movie, venue } of movieVenueMap) {
    for (const startTime of eventDates) {
      const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000);
      const event = await prisma.event.create({
        data: {
          movieId: movie.id,
          startTime,
          endTime,
          status: 'SCHEDULED',
        },
      });

      // Create seats for this event
      const seats = [];
      for (let row = 1; row <= venue.totalRows; row++) {
        for (let col = 1; col <= venue.seatsPerRow; col++) {
          const rowLabel = String.fromCharCode(64 + row);
          const category = row <= 3 ? 'PREMIUM' : row <= 6 ? 'STANDARD' : 'ECONOMY';
          const price = category === 'PREMIUM' ? 150.00 : category === 'STANDARD' ? 100.00 : 60.00;
          seats.push({
            eventId: event.id,
            seatNumber: `${rowLabel}-${col}`,
            row,
            col,
            category,
            price,
          });
        }
      }

      // Batch insert seats
      for (const seat of seats) {
        await prisma.seat.create({ data: seat });
      }

      console.log(`Event ${event.id} created with ${seats.length} seats`);
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
