import {
  AccountType,
  PrismaClient,
  ScooterStatus,
  UserStatus,
} from '@prisma/client'
import { randomInt, randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function runSeeders() {
  // Creating initial institution
  const institution = await prisma.institution.create({
    data: {
      id: randomUUID(),
      name: 'Institution',
      address: 'Institution address',
      email: 'insti@gmail.com',
      contactNumber: '+31243611113',
      contactPersonName: 'John Doe',
      cocNumber: '112233',
      country: 'NL',
    },
  })

  // Creating initial super admin account
  await prisma.user.create({
    data: {
      id: randomUUID(),
      email: 'deelscootmobiel-admin@prostrive.io',
      firstName: 'Super',
      lastName: 'Admin',
      mobileNumber: '+31243611111',
      password: '$2b$10$lq.rMNAf62urmZhPFSXAMuBrOOHF1iFnqT/Bv66gHjQMk3ocXTSBS',
      accountType: AccountType.Admin,
      status: UserStatus.Active,
      admin: {
        create: {},
      },
    },
  })

  // Create initial user account
  await prisma.user.create({
    data: {
      id: randomUUID(),
      email: 'deelscootmobiel-user@prostrive.io',
      firstName: 'John',
      lastName: 'Doe',
      mobileNumber: '+31243611112',
      password: '$2b$10$lq.rMNAf62urmZhPFSXAMuBrOOHF1iFnqT/Bv66gHjQMk3ocXTSBS',
      accountType: AccountType.User,
      status: UserStatus.Active,
      customer: {
        create: {
          id: randomUUID(),
          rfidCardNumber: 'RFID1234567890',
          institutionId: institution.id,
        },
      },
    },
  })

  const scooterPool = await prisma.scooterPool.create({
    data: {
      id: randomUUID(),
      name: 'Scooter Pool 1',
      location: '',
      institutionId: institution.id,
      isActive: true,
    },
  })

  await prisma.scooter.createMany({
    data: [
      {
        id: randomUUID(),
        scooterName: 'Scooter 1',
        scooterPoolId: scooterPool.id,
        currentMileage: 50,
        speed: 25,
        batteryPercentage: 100,
        currentLocation: {},
        status: ScooterStatus.Unavailable,
      },
      {
        id: randomUUID(),
        scooterName: 'Scooter 2',
        scooterPoolId: scooterPool.id,
        currentMileage: 50,
        speed: 25,
        batteryPercentage: 100,
        currentLocation: {},
        status: ScooterStatus.Available,
      },
      {
        id: randomUUID(),
        scooterName: 'Scooter 3',
        scooterPoolId: scooterPool.id,
        currentMileage: 50,
        speed: 25,
        batteryPercentage: 100,
        currentLocation: {},
        status: ScooterStatus.Available,
      },
    ],
  })
}

runSeeders()
  .catch((e) => {
    console.error(`There was an error while seeding: ${e}`)
    process.exit(1)
  })
  .finally(async () => {
    console.log('Successfully seeded database. Closing connection.')
    await prisma.$disconnect()
  })
