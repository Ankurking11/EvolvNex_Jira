import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@evolvnex.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@evolvnex.com',
      role: 'ADMIN',
    },
  })

  const member1 = await prisma.user.upsert({
    where: { email: 'alice@evolvnex.com' },
    update: {},
    create: {
      name: 'Alice Chen',
      email: 'alice@evolvnex.com',
      role: 'MEMBER',
    },
  })

  const member2 = await prisma.user.upsert({
    where: { email: 'bob@evolvnex.com' },
    update: {},
    create: {
      name: 'Bob Smith',
      email: 'bob@evolvnex.com',
      role: 'MEMBER',
    },
  })

  const project1 = await prisma.project.upsert({
    where: { id: 'project-1' },
    update: {},
    create: {
      id: 'project-1',
      name: 'EvolvNex Platform',
      description: 'Core platform development',
      board: {
        create: {
          tasks: {
            create: [
              {
                title: 'Set up CI/CD pipeline',
                description: 'Configure GitHub Actions for automated testing and deployment',
                status: 'DONE',
                priority: 'HIGH',
                assigneeId: admin.id,
              },
              {
                title: 'Design system setup',
                description: 'Create Tailwind design tokens and component library',
                status: 'IN_PROGRESS',
                priority: 'HIGH',
                assigneeId: member1.id,
              },
              {
                title: 'User authentication',
                description: 'Implement JWT-based authentication',
                status: 'IN_PROGRESS',
                priority: 'HIGH',
                assigneeId: member2.id,
              },
              {
                title: 'Dashboard analytics',
                description: 'Add charts and metrics to the main dashboard',
                status: 'TODO',
                priority: 'MEDIUM',
                assigneeId: member1.id,
              },
              {
                title: 'Email notifications',
                description: 'Set up transactional email system',
                status: 'TODO',
                priority: 'LOW',
              },
            ],
          },
        },
      },
    },
  })

  const project2 = await prisma.project.upsert({
    where: { id: 'project-2' },
    update: {},
    create: {
      id: 'project-2',
      name: 'Mobile App',
      description: 'React Native mobile application',
      board: {
        create: {
          tasks: {
            create: [
              {
                title: 'App wireframes',
                description: 'Create wireframes for all screens',
                status: 'DONE',
                priority: 'HIGH',
                assigneeId: member1.id,
              },
              {
                title: 'Navigation setup',
                description: 'Set up React Navigation with all routes',
                status: 'TODO',
                priority: 'HIGH',
                assigneeId: member2.id,
              },
            ],
          },
        },
      },
    },
  })

  console.log('Seed completed:', { admin, member1, member2, project1: project1.id, project2: project2.id })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
