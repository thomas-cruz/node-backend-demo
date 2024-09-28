import { Test, TestingModule } from '@nestjs/testing'
import { BookingsService } from '@/modules/api/bookings/bookings.service'
import { CreateBookingDto } from '@/modules/api/bookings/dto/create-booking.dto'
import { UpdateBookingDto } from '@/modules/api/bookings/dto/update-booking.dto'
import { CreateBookingResponse } from '@/modules/api/bookings/bookings.interface'
import {
  AccountType,
  Booking,
  BookingStatus,
  BookingType,
  Scooter,
  ScooterStatus,
  UserStatus,
} from '@prisma/client'
import { StandardError } from '@/libs/errors/standard-error'
import { ErrorCode, ErrorMessage } from '@/libs/errors/error-codes'
import { HttpStatus } from '@nestjs/common'
import { UsersService } from '@/modules/api/users/users.service'
import { PrismaService } from '@/prisma/prisma.service'
import { BaseUserModel } from '@/modules/api/users/users.interface'
import * as bcrypt from 'bcrypt'

const mockUserBase: BaseUserModel = {
  id: 'existingUser',
  email: 'user@example.com',
  accountType: AccountType.User,
  status: UserStatus.Active,
  customer: {
    id: 'customer123',
    userId: 'existingUser',
    rfidCardNumber: '1234568',
    institutionId: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    firstTimeKiosk: false,
    firstTimeMobile: false,
  },
  firstName: 'Mock',
  lastName: 'User',
  mobileNumber: '+3123456789',
  password: bcrypt.hashSync('password', 10),
  createdAt: new Date(),
  updatedAt: new Date(),
  memo: '',
}

class MockUsersService {
  findUserById(userId: string, _: boolean) {
    // Return a mock user object for known email
    if (userId === 'existingUser') {
      return mockUserBase
    } else if (userId === 'deactivatedUser') {
      return {
        ...mockUserBase,
        userId: 'deactivatedUser',
        email: 'deactivatedUser@example.com',
        accountType: AccountType.User,
        status: UserStatus.Inactive,
      }
    } else if (userId === 'userwithDuplicateBooking') {
      return {
        ...mockUserBase,
        customer: {
          ...mockUserBase.customer,
          id: 'userwithDuplicateBooking',
        },
        userId: 'deactivatedUser',
        email: 'deactivatedUser@example.com',
        accountType: AccountType.User,
        status: UserStatus.Active,
      }
    } else if (userId === 'institutionAdmin') {
      return {
        ...mockUserBase,
        institutionMember: {
          id: 'institutionAdmin',
          institutionId: '_institution',
        },
        userId: 'institutionAdmin',
        email: 'institutionAdmin@example.com',
        accountType: AccountType.InstitutionMember,
        status: UserStatus.Active,
      }
    } else {
      return
    }
  }
}

describe('BookingsService', () => {
  let service: BookingsService
  let prismaService: PrismaService

  const mockBooking: Booking = {
    id: 'booking123',
    customerId: 'userwithDuplicateBooking',
    scooterId: 'scooter123',
    bookingDate: new Date(),
    bookingEndDate: new Date(),
    startedAt: new Date(),
    returnedAt: new Date(),
    bookingType: BookingType.Reservation,
    bookingStatus: BookingStatus.Open,
    duration: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockScooter: Scooter = {
    id: 'scooter123',
    scooterName: 'scooter123',
    status: ScooterStatus.Available,
    scooterPoolId: 'scooterPool1',
    createdAt: new Date(),
    updatedAt: new Date(),
    currentMileage: 0,
    speed: 0,
    batteryPercentage: 0,
    currentLocation: {},
    scooterState: false,
    commandSent: '0',
  }

  const mockBookingResponse: CreateBookingResponse = {
    ...mockBooking,
    scooter: {
      ...mockScooter,
    },
  }

  const mockCustomerScooterPool = {
    customerId: 'existingUser',
    scooterPoolId: 'scooterPool1',
    assignedAt: new Date(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: UsersService, useClass: MockUsersService },
        {
          provide: PrismaService,
          useValue: {
            booking: {
              findFirst: jest.fn(),
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
              findFirstOrThrow: jest.fn(),
            },
            scooter: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
            user: {
              findFirstOrThrow: jest.fn(),
            },
            customerScooterPool: {
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile()

    service = module.get<BookingsService>(BookingsService)
    prismaService = module.get<PrismaService>(PrismaService)
  })

  describe('reserveScooter', () => {
    beforeEach(() => {
      jest.spyOn(prismaService.booking, 'findFirst').mockResolvedValue(null)
      jest.spyOn(prismaService.scooter, 'findFirst').mockResolvedValue(null)
      jest
        .spyOn(prismaService.customerScooterPool, 'findFirst')
        .mockResolvedValue(mockCustomerScooterPool)
    })

    it('should reserve a scooter for the user', async () => {
      const userId = 'existingUser'
      const createBookingDto: CreateBookingDto = {
        bookingType: BookingType.Reservation,
        bookingDate: new Date('2022-05-10 11:00:00'),
        duration: 60,
        scooterPoolId: 'scooterPool1',
      }

      const mockCreatedBooking = {
        ...mockBooking,
        bookingDate: createBookingDto.bookingDate,
        duration: createBookingDto.duration,
        scooter: {
          ...mockScooter,
        },
      }

      jest
        .spyOn(prismaService.scooter, 'findFirst')
        .mockResolvedValue(mockScooter)

      jest
        .spyOn(prismaService.booking, 'create')
        .mockResolvedValue(mockCreatedBooking)

      const result = await service.reserveScooter(userId, createBookingDto)

      expect(result).toBeDefined()
      expect(result.customerId).toBe(mockBooking.customerId)
      expect(result.bookingDate).toBe(createBookingDto.bookingDate)
      expect(result.duration).toBe(createBookingDto.duration)
      expect(result.scooter).toBeDefined()
    })

    it('should return INVALID_BOOKING_TIME error for inactive user', async () => {
      const userId = 'existingUser'
      const createBookingDto: CreateBookingDto = {
        bookingType: BookingType.Reservation,
        bookingDate: new Date('2024-05-09 07:00:00'),
        duration: 60,
        scooterPoolId: 'scooterPool1',
      }

      await expect(
        service.reserveScooter(userId, createBookingDto)
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.INVALID_BOOKING_TIME],
          ErrorCode.INVALID_BOOKING_TIME,
          HttpStatus.BAD_REQUEST
        )
      )
    })

    it('should return INACTIVE_USER error for inactive user', async () => {
      const userId = 'deactivatedUser'
      const createBookingDto: CreateBookingDto = {
        bookingType: BookingType.Reservation,
        bookingDate: new Date('2022-05-10 11:00:00'),
        duration: 60,
        scooterPoolId: 'scooterPool1',
      }

      await expect(
        service.reserveScooter(userId, createBookingDto)
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.INACTIVE_USER],
          ErrorCode.INACTIVE_USER,
          HttpStatus.FORBIDDEN
        )
      )
    })

    it('should return DUPLICATE_BOOKING error for duplicate booking', async () => {
      const userId = 'userwithDuplicateBooking'
      const createBookingDto: CreateBookingDto = {
        bookingType: BookingType.Reservation,
        bookingDate: new Date('2022-05-10 11:00:00'),
        duration: 60,
        scooterPoolId: 'scooterPool1',
      }
      jest
        .spyOn(prismaService.booking, 'findFirst')
        .mockResolvedValue(mockBooking)

      await expect(
        service.reserveScooter(userId, createBookingDto)
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.DUPLICATE_BOOKING],
          ErrorCode.DUPLICATE_BOOKING,
          HttpStatus.BAD_REQUEST
        )
      )
    })

    it('should throw an error if the scooter is not available', async () => {
      const userId = 'existingUser'
      const createBookingDto: CreateBookingDto = {
        bookingType: BookingType.Reservation,
        bookingDate: new Date('2022-05-10 11:00:00'),
        duration: 60,
        scooterPoolId: 'scooterPool1',
      }

      await expect(
        service.reserveScooter(userId, createBookingDto)
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.NO_AVAILABLE_SCOOTER],
          ErrorCode.NO_AVAILABLE_SCOOTER,
          HttpStatus.BAD_REQUEST
        )
      )
    })
  })

  describe('cancelBooking', () => {
    it('should throw an error if booking not found or user does not match', async () => {
      jest.spyOn(prismaService.booking, 'findUnique').mockResolvedValue(null)
      await expect(
        service.cancelBooking('nonexistent-id', 'user123')
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      )
    })

    it('should throw an error if booking is already cancelled', async () => {
      jest.spyOn(prismaService.booking, 'findUnique').mockResolvedValue({
        id: '1',
        customerId: 'user123',
        scooterId: 'scooter456',
        bookingDate: new Date(),
        bookingEndDate: new Date(),
        startedAt: new Date(),
        returnedAt: new Date(),
        bookingType: BookingType.Reservation,
        bookingStatus: BookingStatus.Cancelled,
        duration: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await expect(service.cancelBooking('1', 'user123')).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.INVALID_BOOKING_REQUEST],
          ErrorCode.INVALID_BOOKING_REQUEST,
          HttpStatus.CONFLICT
        )
      )
    })

    it('should throw an error if booking status is not OPEN', async () => {
      jest.spyOn(prismaService.booking, 'findUnique').mockResolvedValue({
        id: '1',
        customerId: 'user123',
        scooterId: 'scooter456',
        bookingDate: new Date(),
        bookingEndDate: new Date(),
        startedAt: null,
        returnedAt: null,
        bookingType: BookingType.Reservation,
        bookingStatus: BookingStatus.Closed,
        duration: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      await expect(service.cancelBooking('1', 'user123')).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.INVALID_BOOKING_REQUEST],
          ErrorCode.INVALID_BOOKING_REQUEST,
          HttpStatus.CONFLICT
        )
      )
    })

    it('should return a success message if booking is successfully cancelled', async () => {
      jest.spyOn(prismaService.booking, 'findUnique').mockResolvedValue({
        id: '1',
        customerId: 'user123',
        scooterId: 'scooter456',
        bookingDate: new Date(),
        bookingEndDate: new Date(),
        startedAt: null,
        returnedAt: null,
        bookingType: BookingType.Reservation,
        bookingStatus: BookingStatus.Open,
        duration: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      jest.spyOn(prismaService.booking, 'update').mockResolvedValue({
        id: '1',
        customerId: 'user123',
        scooterId: 'scooter456',
        bookingDate: new Date(),
        bookingEndDate: new Date(),
        startedAt: new Date(),
        returnedAt: new Date(),
        bookingType: BookingType.Reservation,
        bookingStatus: BookingStatus.Cancelled,
        duration: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.cancelBooking('1', 'user123')
      expect(result).toEqual({ message: 'Booking successfully cancelled' })
      expect(prismaService.booking.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { bookingStatus: BookingStatus.Cancelled },
      })
    })
  })

  describe('getAvailableTimeSlots', () => {
    it('should return hourly timeslot for duration 60', async () => {
      const userId = 'existingUser'
      const duration = 60
      const bookingDate = '2022-05-10'
      const expectedTimeSlots = [
        { timeslot: '08:00', alreadyBooked: false },
        { timeslot: '09:00', alreadyBooked: false },
        { timeslot: '10:00', alreadyBooked: false },
        { timeslot: '11:00', alreadyBooked: false },
        { timeslot: '12:00', alreadyBooked: false },
        { timeslot: '13:00', alreadyBooked: false },
        { timeslot: '14:00', alreadyBooked: false },
        { timeslot: '15:00', alreadyBooked: false },
        { timeslot: '16:00', alreadyBooked: false },
        { timeslot: '17:00', alreadyBooked: false },
        { timeslot: '18:00', alreadyBooked: false },
        { timeslot: '19:00', alreadyBooked: false },
      ]

      jest.spyOn(service, 'getScootersAndBookingsByDate').mockResolvedValue([
        {
          id: 'scooter123',
          scooterName: 'scooter123',
          status: ScooterStatus.Available,
          scooterPoolId: 'scooterPool1',
          createdAt: new Date(),
          updatedAt: new Date(),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 0,
          currentLocation: {},
          booking: [],
          scooterState: false,
          commandSent: '0',
        },
      ])
      const result = await service.getAvailableTimeSlots(
        userId,
        duration,
        'scooterPool1',
        bookingDate
      )

      expect(result).toEqual(expectedTimeSlots)
    })

    it('should return timeslot for 2 hrs', async () => {
      const userId = 'existingUser'
      const duration = 120
      const bookingDate = '2022-05-10'
      const expectedTimeSlots = [
        { timeslot: '08:00', alreadyBooked: false },
        { timeslot: '09:00', alreadyBooked: false },
        { timeslot: '10:00', alreadyBooked: false },
        { timeslot: '11:00', alreadyBooked: false },
        { timeslot: '12:00', alreadyBooked: false },
        { timeslot: '13:00', alreadyBooked: false },
        { timeslot: '14:00', alreadyBooked: false },
        { timeslot: '15:00', alreadyBooked: false },
        { timeslot: '16:00', alreadyBooked: false },
        { timeslot: '17:00', alreadyBooked: false },
        { timeslot: '18:00', alreadyBooked: false },
      ]

      jest.spyOn(service, 'getScootersAndBookingsByDate').mockResolvedValue([
        {
          id: 'scooter123',
          scooterName: 'scooter123',
          status: ScooterStatus.Available,
          scooterPoolId: 'scooterPool1',
          createdAt: new Date(),
          updatedAt: new Date(),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 0,
          currentLocation: {},
          booking: [],
          scooterState: false,
          commandSent: '0',
        },
      ])
      const result = await service.getAvailableTimeSlots(
        userId,
        duration,
        'scooterPool1',
        bookingDate
      )

      expect(result).toEqual(expectedTimeSlots)
    })

    it('should return timeslot for 4 hrs', async () => {
      const userId = 'existingUser'
      const duration = 240
      const bookingDate = '2022-05-10'

      const expectedTimeSlots = [
        { timeslot: '08:00', alreadyBooked: false },
        { timeslot: '09:00', alreadyBooked: false },
        { timeslot: '10:00', alreadyBooked: false },
        { timeslot: '11:00', alreadyBooked: false },
        { timeslot: '12:00', alreadyBooked: false },
        { timeslot: '13:00', alreadyBooked: false },
        { timeslot: '14:00', alreadyBooked: false },
        { timeslot: '15:00', alreadyBooked: false },
        { timeslot: '16:00', alreadyBooked: false },
      ]

      jest.spyOn(service, 'getScootersAndBookingsByDate').mockResolvedValue([
        {
          id: 'scooter123',
          scooterName: 'scooter123',
          status: ScooterStatus.Available,
          scooterPoolId: 'scooterPool1',
          createdAt: new Date(),
          updatedAt: new Date(),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 0,
          currentLocation: {},
          booking: [],
          scooterState: false,
          commandSent: '0',
        },
      ])
      const result = await service.getAvailableTimeSlots(
        userId,
        duration,
        'scooterPool1',
        bookingDate
      )

      expect(result).toEqual(expectedTimeSlots)
    })

    it('should return timeslot for 8 hrs', async () => {
      const userId = 'existingUser'
      const duration = 480
      const bookingDate = '2022-05-10'
      const expectedTimeSlots = [
        { timeslot: '08:00', alreadyBooked: false },
        { timeslot: '09:00', alreadyBooked: false },
        { timeslot: '10:00', alreadyBooked: false },
        { timeslot: '11:00', alreadyBooked: false },
        { timeslot: '12:00', alreadyBooked: false },
      ]

      jest.spyOn(service, 'getScootersAndBookingsByDate').mockResolvedValue([
        {
          id: 'scooter123',
          scooterName: 'scooter123',
          status: ScooterStatus.Available,
          scooterPoolId: 'scooterPool1',
          createdAt: new Date(),
          updatedAt: new Date(),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 0,
          currentLocation: {},
          booking: [],
          scooterState: false,
          commandSent: '0',
        },
      ])
      const result = await service.getAvailableTimeSlots(
        userId,
        duration,
        'scooterPool1',
        bookingDate
      )

      expect(result).toEqual(expectedTimeSlots)
    })

    it('should not return slots with booked scooters', async () => {
      const userId = 'existingUser'
      const duration = 60
      const bookingDate = '2022-05-10'
      const expectedTimeSlots = [
        { timeslot: '08:00', alreadyBooked: false },
        { timeslot: '12:00', alreadyBooked: false },
        { timeslot: '13:00', alreadyBooked: false },
        { timeslot: '14:00', alreadyBooked: false },
        { timeslot: '18:00', alreadyBooked: false },
        { timeslot: '19:00', alreadyBooked: false },
      ]

      jest.spyOn(service, 'getScootersAndBookingsByDate').mockResolvedValue([
        {
          id: 'scooter123',
          scooterName: 'scooter123',
          status: ScooterStatus.Available,
          scooterPoolId: 'scooterPool1',
          createdAt: new Date(),
          updatedAt: new Date(),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 0,
          currentLocation: {},
          booking: [
            {
              id: 'booking123',
              customerId: 'user123',
              scooterId: 'scooter123',
              bookingDate: new Date('2022-05-10 10:00:00'),
              bookingEndDate: new Date('2022-05-10 11:00:00'),
              startedAt: new Date(),
              returnedAt: new Date(),
              bookingType: BookingType.Reservation,
              bookingStatus: BookingStatus.Open,
              duration: 60,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'booking1234',
              customerId: 'user123',
              scooterId: 'scooter123',
              bookingDate: new Date('2022-05-10 16:00:00'),
              bookingEndDate: new Date('2022-05-10 17:00:00'),
              startedAt: new Date(),
              returnedAt: new Date(),
              bookingType: BookingType.Reservation,
              bookingStatus: BookingStatus.Open,
              duration: 60,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          scooterState: false,
          commandSent: '0',
        },
      ])
      const result = await service.getAvailableTimeSlots(
        userId,
        duration,
        'scooterPool1',
        bookingDate
      )

      expect(result).toEqual(expectedTimeSlots)
    })

    it('should flag alreadyBooked when user already book for that timeslot', async () => {
      const userId = 'existingUser'
      const duration = 60
      const bookingDate = '2022-05-10'
      const expectedTimeSlots = [
        { timeslot: '08:00', alreadyBooked: false },
        { timeslot: '09:00', alreadyBooked: false },
        { timeslot: '10:00', alreadyBooked: true },
        { timeslot: '11:00', alreadyBooked: false },
        { timeslot: '12:00', alreadyBooked: false },
        { timeslot: '13:00', alreadyBooked: false },
        { timeslot: '14:00', alreadyBooked: false },
        { timeslot: '18:00', alreadyBooked: false },
        { timeslot: '19:00', alreadyBooked: false },
      ]

      jest.spyOn(service, 'getScootersAndBookingsByDate').mockResolvedValue([
        {
          id: 'scooter1234',
          scooterName: 'scooter1234',
          status: ScooterStatus.Available,
          scooterPoolId: 'scooterPool1',
          createdAt: new Date(),
          updatedAt: new Date(),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 0,
          currentLocation: {},
          booking: [
            {
              id: 'booking1234',
              customerId: 'user123',
              scooterId: 'scooter123',
              bookingDate: new Date('2022-05-10 16:00:00'),
              bookingEndDate: new Date('2022-05-10 17:00:00'),
              startedAt: new Date(),
              returnedAt: new Date(),
              bookingType: BookingType.Reservation,
              bookingStatus: BookingStatus.Open,
              duration: 60,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          scooterState: false,
          commandSent: '0',
        },
        {
          id: 'scooter123',
          scooterName: 'scooter123',
          status: ScooterStatus.Available,
          scooterPoolId: 'scooterPool1',
          createdAt: new Date(),
          updatedAt: new Date(),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 0,
          currentLocation: {},
          booking: [
            {
              id: 'booking123',
              customerId: 'customer123',
              scooterId: 'scooter123',
              bookingDate: new Date('2022-05-10 10:00:00'),
              bookingEndDate: new Date('2022-05-10 11:00:00'),
              startedAt: new Date(),
              returnedAt: new Date(),
              bookingType: BookingType.Reservation,
              bookingStatus: BookingStatus.Open,
              duration: 60,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: 'booking1234',
              customerId: 'user123',
              scooterId: 'scooter123',
              bookingDate: new Date('2022-05-10 16:00:00'),
              bookingEndDate: new Date('2022-05-10 17:00:00'),
              startedAt: new Date(),
              returnedAt: new Date(),
              bookingType: BookingType.Reservation,
              bookingStatus: BookingStatus.Open,
              duration: 60,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          scooterState: false,
          commandSent: '0',
        },
      ])
      const result = await service.getAvailableTimeSlots(
        userId,
        duration,
        'scooterPool1',
        bookingDate
      )

      expect(result).toEqual(expectedTimeSlots)
    })

    it('should not return slots with booked scooters 8hrs duration', async () => {
      const userId = 'existingUser'
      const duration = 480
      const bookingDate = '2022-05-10'
      const expectedTimeSlots = []

      jest.spyOn(service, 'getScootersAndBookingsByDate').mockResolvedValue([
        {
          id: 'scooter123',
          scooterName: 'scooter123',
          status: ScooterStatus.Available,
          scooterPoolId: 'scooterPool1',
          createdAt: new Date(),
          updatedAt: new Date(),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 0,
          currentLocation: {},
          booking: [
            {
              id: 'booking123',
              customerId: 'user123',
              scooterId: 'scooter123',
              bookingDate: new Date('2022-05-10 08:00:00'),
              bookingEndDate: new Date('2022-05-10 17:00:00'),
              startedAt: new Date(),
              returnedAt: new Date(),
              bookingType: BookingType.Reservation,
              bookingStatus: BookingStatus.Open,
              duration: 480,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
          scooterState: false,
          commandSent: '0',
        },
      ])
      const result = await service.getAvailableTimeSlots(
        userId,
        duration,
        'scooterPool1',
        bookingDate
      )

      expect(result).toEqual(expectedTimeSlots)
    })
  })

  describe('findBookingById', () => {
    it('should return the booking with the specified bookingId', async () => {
      const bookingId = 'booking123'
      const userId = 'user123'
      const includeScooter = true

      jest
        .spyOn(prismaService.booking, 'findFirstOrThrow')
        .mockResolvedValue(mockBookingResponse)

      const result = await service.findBookingById(
        bookingId,
        userId,
        includeScooter
      )

      expect(result).toEqual(mockBookingResponse)
    })

    it('should throw an error if the booking is not found', async () => {
      const bookingId = 'invalidBookingId'
      const userId = 'user123'
      const includeScooter = true

      jest
        .spyOn(prismaService.booking, 'findFirstOrThrow')
        .mockRejectedValue({ code: 'P2025', meta: { target: 'Booking' } })

      await expect(
        service.findBookingById(bookingId, userId, includeScooter)
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      )
    })
  })

  describe('updateBooking', () => {
    let bookingId: string
    let updateBookingDto: UpdateBookingDto
    let existingBooking: CreateBookingResponse

    beforeEach(() => {
      bookingId = 'some-booking-id'
      updateBookingDto = {
        duration: 120,
      }
      existingBooking = {
        id: '100001',
        customerId: 'some-user-id',
        bookingDate: new Date('2024-05-01 10:03:24.847'),
        bookingEndDate: new Date('2024-05-01 12:03:24.847'),
        startedAt: null,
        returnedAt: null,
        bookingType: 'OnDemand',
        bookingStatus: 'Open',
        duration: 60,
        scooterId: '1',
        createdAt: new Date('2024-05-01 10:03:24.847'),
        updatedAt: new Date('2024-05-01 10:03:24.847'),
        scooter: {
          id: '1',
          scooterName: 'scooter1',
          status: 'Available',
          scooterPoolId: 'pool1',
          createdAt: new Date('2024-05-01 10:03:24.847'),
          updatedAt: new Date('2024-05-01 10:03:24.847'),
          currentMileage: 0,
          speed: 0,
          batteryPercentage: 100,
          currentLocation: {},
          scooterState: false,
          commandSent: '0',
        },
      }
    })

    it('should throw an error if booking is not found', async () => {
      await expect(
        service.updateBooking(mockUserBase.id, 'invalid-id', updateBookingDto)
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      )
    })

    it('should update the booking', async () => {
      jest
        .spyOn(prismaService.booking, 'findFirstOrThrow')
        .mockResolvedValue(existingBooking)
      jest.spyOn(prismaService.booking, 'findMany').mockResolvedValue([])
      jest.spyOn(prismaService.booking, 'update').mockResolvedValue({
        ...existingBooking,
        ...updateBookingDto,
      })

      const result = await service.updateBooking(
        mockUserBase.id,
        bookingId,
        updateBookingDto
      )

      expect(result).toEqual({
        ...existingBooking,
        ...updateBookingDto,
      })
      expect(prismaService.booking.update).toHaveBeenCalledWith({
        where: { id: bookingId },
        data: {
          ...updateBookingDto,
          bookingEndDate: new Date('2024-05-01 12:03:24.847'),
        },
        include: { scooter: { include: { scooterPool: true } } },
      })
    })
  })

  describe('adminCancelBooking', () => {
    const adminUser = new MockUsersService().findUserById(
      'institutionAdmin',
      true
    )
    const mockBooking = {
      id: '1',
      customerId: 'user123',
      scooterId: 'scooter456',
      bookingDate: new Date(),
      bookingEndDate: new Date(),
      startedAt: new Date(),
      returnedAt: new Date(),
      bookingType: BookingType.Reservation,
      bookingStatus: BookingStatus.Open,
      duration: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      customer: {
        institutionId: '_institution',
      },
    }
    const mockBookingInstitution = {
      ...mockBooking,
      customer: {
        institutionId: 1,
      },
    }
    it('should throw an error if booking not found or user does not exist', async () => {
      jest
        .spyOn(prismaService.user, 'findFirstOrThrow')
        .mockResolvedValue(adminUser)
      jest.spyOn(prismaService.booking, 'findUnique').mockResolvedValue(null)
      await expect(
        service.adminCancelBooking('nonexistent-id', 'institutionAdmin')
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      )
    })

    it('should throw an error if booking is from different institution', async () => {
      jest
        .spyOn(prismaService.user, 'findFirstOrThrow')
        .mockResolvedValue(adminUser)
      jest
        .spyOn(prismaService.booking, 'findUnique')
        .mockResolvedValue(mockBookingInstitution)
      await expect(
        service.adminCancelBooking('1', 'institutionAdmin')
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      )
    })

    it('should throw an error if booking is already cancelled', async () => {
      jest
        .spyOn(prismaService.user, 'findFirstOrThrow')
        .mockResolvedValue(adminUser)
      jest.spyOn(prismaService.booking, 'findUnique').mockResolvedValue({
        ...mockBooking,
        bookingStatus: BookingStatus.Cancelled,
      })
      await expect(
        service.adminCancelBooking('1', 'institutionAdmin')
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.INVALID_BOOKING_REQUEST],
          ErrorCode.INVALID_BOOKING_REQUEST,
          HttpStatus.CONFLICT
        )
      )
    })

    it('should throw an error if booking status is not OPEN', async () => {
      jest
        .spyOn(prismaService.user, 'findFirstOrThrow')
        .mockResolvedValue(adminUser)
      jest.spyOn(prismaService.booking, 'findUnique').mockResolvedValue({
        ...mockBooking,
        bookingStatus: BookingStatus.Closed,
      })
      await expect(
        service.adminCancelBooking('1', 'institutionAdmin')
      ).rejects.toThrow(
        new StandardError(
          ErrorMessage[ErrorCode.INVALID_BOOKING_REQUEST],
          ErrorCode.INVALID_BOOKING_REQUEST,
          HttpStatus.CONFLICT
        )
      )
    })

    it('should return a success message if booking is successfully cancelled', async () => {
      jest
        .spyOn(prismaService.user, 'findFirstOrThrow')
        .mockResolvedValue(adminUser)
      jest.spyOn(prismaService.booking, 'findUnique').mockResolvedValue({
        ...mockBooking,
        startedAt: null,
        returnedAt: null,
      })
      jest.spyOn(prismaService.booking, 'update').mockResolvedValue({
        id: '1',
        customerId: 'user123',
        scooterId: 'scooter456',
        bookingDate: new Date(),
        bookingEndDate: new Date(),
        startedAt: new Date(),
        returnedAt: new Date(),
        bookingType: BookingType.Reservation,
        bookingStatus: BookingStatus.Cancelled,
        duration: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.adminCancelBooking('1', 'institutionAdmin')
      expect(result).toEqual({ message: 'Booking successfully cancelled' })
      expect(prismaService.booking.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { bookingStatus: BookingStatus.Cancelled },
      })
    })
  })
})
