import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

// Mock Prisma
const prismaMock = mockDeep<PrismaClient>();

export default prismaMock;
export { prismaMock };
