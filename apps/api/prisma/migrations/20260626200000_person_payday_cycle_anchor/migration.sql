-- AlterTable
ALTER TABLE "Person" ADD COLUMN "paydayCycleAnchor" TEXT NOT NULL DEFAULT 'end';

-- Copia a preferência do usuário para cada pessoa (legado)
UPDATE "Person" p
SET "paydayCycleAnchor" = u."paydayCycleAnchor"
FROM "User" u
WHERE p."userId" = u.id;

ALTER TABLE "User" DROP COLUMN "paydayCycleAnchor";
