-- AlterTable
ALTER TABLE "Person" ADD COLUMN "paydayDay" INTEGER;

-- Copia o dia de pagamento do usuário para pessoas já cadastradas
UPDATE "Person" p
SET "paydayDay" = u."paydayDay"
FROM "User" u
WHERE p."userId" = u.id AND u."paydayDay" IS NOT NULL;
