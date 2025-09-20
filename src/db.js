import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function getOrCreateUser(tgFrom) {
  const id = String(tgFrom.id);
  const user = await prisma.user.upsert({
    where: { id },
    update: {
      username: tgFrom.username ?? undefined,
      firstName: tgFrom.first_name ?? tgFrom.firstName ?? undefined,
      lastName: tgFrom.last_name ?? tgFrom.lastName ?? undefined
    },
    create: {
      id,
      step: 'dest',
      username: tgFrom.username ?? null,
      firstName: tgFrom.first_name ?? tgFrom.firstName ?? null,
      lastName: tgFrom.last_name ?? tgFrom.lastName ?? null
    }
  });
  return user;
}
