import { PrismaClient, type ContentStatus } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { computeReadingMinutes } from "@/lib/services/articles";
import {
  profile as profileContent,
  projects as projectsContent,
  experiences as experiencesContent,
  skills as skillsContent,
  services as servicesContent,
  articles as articlesContent,
} from "./content";

// `prisma db seed` charge .env lui-même et le transmet à ce process (tsx) —
// pas de chargement explicite ici, un seul fichier d'environnement (cf. CLAUDE.md).

const prisma = new PrismaClient();

/**
 * prisma/content.ts contient des notes de travail entre <!-- --> : des
 * questions à traiter depuis /admin, pas du contenu publiable. On les retire
 * avant insertion, mais on garde le titre de section "## À COMPLÉTER" pour
 * les retrouver facilement — seul le bloc de commentaire est supprimé, pas
 * le titre qui le précède.
 */
function stripWorkingNotes(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, "").trimEnd();
}

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
  // `focusNow` existe dans prisma/content.ts (repris de docs/03-DESIGN-SYSTEM.md,
  // §00 Ouverture : "FOCUS ACTUEL : ...") mais AUCUN champ correspondant
  // n'existe dans le modèle Profile (prisma/schema.prisma). Écart entre le
  // design system et le schéma — signalé plutôt que contourné, ignoré ici.
  const { focusNow: _focusNow, ...data } = profileContent;

  return prisma.profile.upsert({
    where: { id: "profile" },
    update: data,
    create: { id: "profile", ...data },
  });
}

async function seedProjects() {
  for (const p of projectsContent) {
    const content = stripWorkingNotes(p.content);
    const data = {
      title: p.title,
      domain: p.domain,
      role: p.role,
      year: p.year,
      status: p.status as ContentStatus,
      featured: p.featured,
      order: p.order,
      stack: p.stack,
      outcomes: p.outcomes,
      summary: p.summary,
      content,
      links: p.links,
    };

    await prisma.project.upsert({
      where: { slug: p.slug },
      update: data,
      // publishedAt fixé une seule fois, à la création — un reseed ne doit
      // pas réécrire la date de première publication à chaque exécution.
      create: {
        slug: p.slug,
        ...data,
        publishedAt: p.status === "PUBLISHED" ? new Date() : null,
      },
    });
  }
}

/**
 * Experience n'a pas de contrainte @@unique en base (contrairement à
 * projects/services/articles sur slug, ou skills sur [name, category]).
 * [org, role] sert de clé stable applicative : on cherche d'abord, on met à
 * jour ou on crée — c'est la même idempotence qu'un upsert, sans migration.
 */
async function seedExperiences() {
  for (const e of experiencesContent) {
    const data = {
      location: e.location ?? null,
      startDate: new Date(e.startDate),
      endDate: e.endDate ? new Date(e.endDate) : null,
      current: e.current,
      order: e.order,
      summary: e.summary,
      highlights: e.highlights,
    };

    const existing = await prisma.experience.findFirst({
      where: { org: e.org, role: e.role },
      select: { id: true },
    });

    if (existing) {
      await prisma.experience.update({ where: { id: existing.id }, data });
    } else {
      await prisma.experience.create({ data: { org: e.org, role: e.role, ...data } });
    }
  }
}

async function seedSkills() {
  for (const s of skillsContent) {
    const data = { order: s.order, context: s.context || null };

    await prisma.skill.upsert({
      where: { name_category: { name: s.name, category: s.category } },
      update: data,
      create: { name: s.name, category: s.category, ...data },
    });
  }
}

async function seedServices() {
  // L'ancien seed (fondations) utilisait le slug "appel-de-decouverte" ;
  // prisma/content.ts (contenu réel) utilise "appel-decouverte". Sans ce
  // nettoyage, les deux coexisteraient comme deux offres distinctes.
  await prisma.service.deleteMany({ where: { slug: "appel-de-decouverte" } });

  for (const s of servicesContent) {
    const data = {
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      bufferMin: s.bufferMin,
      order: s.order,
    };

    await prisma.service.upsert({
      where: { slug: s.slug },
      update: data,
      create: { slug: s.slug, ...data },
    });
  }
}

async function seedArticles() {
  for (const a of articlesContent) {
    const content = stripWorkingNotes(a.content);
    const data = {
      title: a.title,
      excerpt: a.excerpt,
      content,
      tags: a.tags,
      status: a.status as ContentStatus,
      readingMinutes: computeReadingMinutes(content),
    };

    await prisma.article.upsert({
      where: { slug: a.slug },
      update: data,
      create: {
        slug: a.slug,
        ...data,
        publishedAt: a.status === "PUBLISHED" ? new Date() : null,
      },
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
  await seedProjects();
  await seedExperiences();
  await seedSkills();
  await seedServices();
  await seedArticles();
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
