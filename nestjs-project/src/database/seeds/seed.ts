import { AppDataSource } from '../data-source';
import { Category } from '../../videos/category.entity';

const categories = [
  { name: 'Music', slug: 'music', displayOrder: 1 },
  { name: 'Gaming', slug: 'gaming', displayOrder: 2 },
  { name: 'Education', slug: 'education', displayOrder: 3 },
  { name: 'Entertainment', slug: 'entertainment', displayOrder: 4 },
  { name: 'Sports', slug: 'sports', displayOrder: 5 },
  { name: 'News', slug: 'news', displayOrder: 6 },
  { name: 'Technology', slug: 'technology', displayOrder: 7 },
  { name: 'Science', slug: 'science', displayOrder: 8 },
  { name: 'Comedy', slug: 'comedy', displayOrder: 9 },
  { name: 'How-to & DIY', slug: 'how-to-diy', displayOrder: 10 },
  { name: 'Vlogs', slug: 'vlogs', displayOrder: 11 },
  { name: 'Other', slug: 'other', displayOrder: 99 },
];

async function runSeed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connection initialized');

  const categoryRepo = AppDataSource.getRepository(Category);
  const existing = await categoryRepo.count();
  if (existing === 0) {
    await categoryRepo.save(categories);
    console.log(`Seeded ${categories.length} categories`);
  } else {
    console.log(`Categories already seeded (${existing} found)`);
  }

  await AppDataSource.destroy();
  console.log('Database connection closed');
}

runSeed().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
