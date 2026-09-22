import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

// `prisma db seed` charge .env lui-même et le transmet à ce process (tsx) —
// pas de chargement explicite ici, un seul fichier d'environnement (cf. CLAUDE.md).

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL et ADMIN_PASSWORD sont requis dans .env pour le seed.");
  }

  // hash() utilise Argon2id par défaut (D2).
  const passwordHash = await hash(password);

  return prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: "Akomede", role: "ADMIN" },
  });
}

async function seedProfile() {
  return prisma.profile.upsert({
    where: { id: "profile" },
    update: {},
    create: {
      id: "profile",
      fullName: "Akomede",
      // Texte court volontairement provisoire — à réécrire depuis /admin.
      headline: "Étudiant en sécurité des systèmes informatiques",
      bio: "Étudiant HECM (Bénin), spécialisation Sécurité des Systèmes Informatiques.",
      location: "Cotonou, Bénin",
      timezone: "Africa/Lagos",
      email: process.env.ADMIN_EMAIL!,
      availability: "Disponible pour des missions ponctuelles",
      openToWork: true,
      socials: { github: "", linkedin: "", x: "", facebook: "" },
    },
  });
}

async function seedServices() {
  const services = [
    {
      slug: "appel-de-decouverte",
      name: "Appel de découverte",
      description: "Un premier échange pour cadrer votre besoin.",
      durationMin: 30,
    },
    {
      slug: "revue-technique",
      name: "Revue technique",
      description: "Analyse approfondie d'un projet ou d'une architecture existante.",
      durationMin: 60,
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: { slug: service.slug },
      update: {},
      create: service,
    });
  }
}

async function seedAvailability() {
  // Lundi (1) à vendredi (5), 09:00-17:00.
  for (let weekday = 1; weekday <= 5; weekday++) {
    await prisma.availabilityRule.upsert({
      where: {
        weekday_startMinute_endMinute: { weekday, startMinute: 540, endMinute: 1020 },
      },
      update: {},
      create: { weekday, startMinute: 540, endMinute: 1020 },
    });
  }
}

async function main() {
  const admin = await seedAdmin();
  await seedProfile();
  await seedServices();
  await seedAvailability();
  console.log(`Seed OK — admin: ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
