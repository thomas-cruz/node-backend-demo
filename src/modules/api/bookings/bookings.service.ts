import { DurationOptions } from '@/libs/constants/bookings.constant'
import { ErrorCode, ErrorMessage } from '@/libs/errors/error-codes'
import { StandardError } from '@/libs/errors/standard-error'
import BookingHelper from '@/libs/helpers/booking.helper'
import DateHelper from '@/libs/helpers/date.helper'
import {
  AvailableDuration,
  AvailableTimeslots,
  CreateBookingWithScooterPoolResponse,
  ScooterDetails,
} from '@/modules/api/bookings/bookings.interface'
import { CreateBookingDto } from '@/modules/api/bookings/dto/create-booking.dto'
import { UpdateBookingDto } from '@/modules/api/bookings/dto/update-booking.dto'
import { BaseUserModel } from '@/modules/api/users/users.interface'
import { UsersService } from '@/modules/api/users/users.service'
import { PrismaService } from '@/prisma/prisma.service'
import {
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import {
  AccountType,
  Booking,
  BookingStatus,
  BookingType,
  Prisma,
  Scooter,
  ScooterStatus,
  UserStatus,
} from '@prisma/client'

@Injectable()
export class BookingsService {
  private logger = new Logger(BookingsService.name)
  private readonly END_TIME_BUFFER: number = 60
  private readonly BOOKING_START_TIME_BLOCK: number = 8
  private readonly BOOKING_END_TIME_BLOCK: number = 20

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UsersService
  ) {}

  async findOne(userId: string): Promise<Booking | undefined> {
    return this.prisma.booking.findFirst({
      where: {
        customer: {
          userId,
        },
      },
    })
  }

  async reserveScooter(
    userId: string,
    createBookingDto: CreateBookingDto
  ): Promise<CreateBookingWithScooterPoolResponse> {
    try {
      const user = await this.userService.findUserById(userId, true)

      if (!user?.customer) {
        throw new StandardError(
          ErrorMessage[ErrorCode.USER_NOT_FOUND],
          ErrorCode.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      } else if (user.status !== UserStatus.Active) {
        throw new StandardError(
          ErrorMessage[ErrorCode.INACTIVE_USER],
          ErrorCode.INACTIVE_USER,
          HttpStatus.FORBIDDEN
        )
      }

      if (createBookingDto.bookingType === BookingType.OnDemand) {
        createBookingDto.bookingDate = DateHelper.getClosestHourMark()
      }

      await this.validateBookingDetails(user, createBookingDto)

      const scooter = await this.findAvailableScooter(
        createBookingDto.scooterPoolId,
        createBookingDto.bookingDate,
        createBookingDto.duration
      )

      if (scooter) {
        return this.create(user, scooter, createBookingDto)
      } else {
        throw new StandardError(
          ErrorMessage[ErrorCode.NO_AVAILABLE_SCOOTER],
          ErrorCode.NO_AVAILABLE_SCOOTER,
          HttpStatus.NOT_FOUND
        )
      }
    } catch (error) {
      if (error instanceof StandardError) {
        throw error
      }

      this.logger.error(error)
      throw new InternalServerErrorException(error.message)
    }
  }

  async create(
    user: BaseUserModel,
    scooter: Scooter,
    createBookingDto: CreateBookingDto
  ): Promise<CreateBookingWithScooterPoolResponse> {
    try {
      return await this.prisma.booking.create({
        data: {
          bookingDate: createBookingDto.bookingDate,
          bookingEndDate: new Date(
            createBookingDto.bookingDate.getTime() +
              createBookingDto.duration * 60000
          ),
          bookingType: createBookingDto.bookingType,
          duration: createBookingDto.duration,
          scooterId: scooter.id,
          customerId: user.customer.id,
        },
        include: {
          scooter: { include: { scooterPool: true } },
        },
      })
    } catch (error) {
      this.logger.error(error)

      throw new StandardError(
        ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  async findAvailableScooter(
    scooterPoolId: string,
    bookingDate: Date,
    duration: number
  ): Promise<Scooter> {
    try {
      // Add a buffer time of 1 hr for both start and end time this will ensure that the scooter is available in consideration for late return
      const bufferedStartTime = new Date(
        bookingDate.getTime() - this.END_TIME_BUFFER * 60000
      )
      const endTime = new Date(
        bookingDate.getTime() + (duration + this.END_TIME_BUFFER) * 60000
      )

      return await this.prisma.scooter.findFirst({
        where: {
          scooterPool: {
            id: scooterPoolId,
          },
          NOT: {
            OR: [
              {
                status: ScooterStatus.Unavailable,
              },
              {
                booking: {
                  some: {
                    NOT: { bookingStatus: BookingStatus.Cancelled },
                    AND: [
                      { bookingDate: { gte: bufferedStartTime } },
                      { bookingEndDate: { lte: endTime } },
                    ],
                  },
                },
              },
            ],
          },
        },
      })
    } catch (error) {
      this.logger.error(error)

      throw new StandardError(
        ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  private async validateBookingDetails(
    user: BaseUserModel,
    bookingDto: CreateBookingDto
  ): Promise<void> {
    this.validateBookingHours(bookingDto)

    const userScooterPool = await this.prisma.customerScooterPool.findFirst({
      where: {
        scooterPoolId: bookingDto.scooterPoolId,
        customerId: user.customer.id,
      },
    })

    if (!userScooterPool) {
      this.logger.error(
        `Customer ${user.customer.id} does not have access to the scooter pool ${bookingDto.scooterPoolId}`
      )
      throw new StandardError(
        ErrorMessage[ErrorCode.INVALID_BOOKING_REQUEST],
        ErrorCode.INVALID_BOOKING_REQUEST,
        HttpStatus.BAD_REQUEST
      )
    }

    const duplicateBooking = await this.prisma.booking.findFirst({
      where: {
        bookingDate: bookingDto.bookingDate,
        customer: {
          id: user.customer.id,
        },
        bookingStatus: {
          not: BookingStatus.Cancelled,
        },
      },
    })

    if (duplicateBooking) {
      throw new StandardError(
        ErrorMessage[ErrorCode.DUPLICATE_BOOKING],
        ErrorCode.DUPLICATE_BOOKING,
        HttpStatus.BAD_REQUEST
      )
    }
  }

  public validateBookingHours(bookingDto: CreateBookingDto) {
    const bookingDateHours = bookingDto.bookingDate.getHours() //using getHours as getUTCHours was giving different values
    const bookingEndHours = bookingDateHours + bookingDto.duration / 60
    if (
      bookingDateHours < this.BOOKING_START_TIME_BLOCK ||
      bookingDateHours > this.BOOKING_END_TIME_BLOCK ||
      bookingEndHours > this.BOOKING_END_TIME_BLOCK
    ) {
      throw new StandardError(
        ErrorMessage[ErrorCode.INVALID_BOOKING_TIME],
        ErrorCode.INVALID_BOOKING_TIME,
        HttpStatus.BAD_REQUEST
      )
    }
  }

  async findAll({
    search,
    page = 0,
    limit = 10,
    sortBy = 'bookingDate',
    sortOrder = 'asc',
    userId,
  }: {
    search?: string
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    userId: string
  }) {
    // Fetch the institutionId for the user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { institutionMember: true },
    })

    const institutionId = user?.institutionMember?.institutionId

    const query: { where: Prisma.BookingWhereInput } = {
      where: {
        ...(institutionId && {
          customer: {
            institutionId: institutionId,
          },
        }),
      },
    }

    if (search) {
      query.where = {
        AND: [
          query.where,
          {
            OR: [
              {
                customer: {
                  user: {
                    firstName: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                customer: {
                  user: { lastName: { contains: search, mode: 'insensitive' } },
                },
              },
              {
                customer: {
                  rfidCardNumber: { contains: search, mode: 'insensitive' },
                },
              },
              { scooterId: { contains: search, mode: 'insensitive' } },
            ],
          },
        ],
      }
    }

    const orderBy = {}
    if (sortBy) {
      orderBy[sortBy] = sortOrder
    }

    const [bookings, count] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        ...(Object.keys(query.where).length && query),
        orderBy,
        skip: page * limit,
        take: limit,
        include: {
          customer: {
            include: {
              user: true,
            },
          },
          scooter: true,
        },
      }),
      this.prisma.booking.count(query),
    ])

    return {
      page,
      per_page: limit,
      page_count: Math.ceil(count / limit),
      total_count: count,
      data: bookings,
    }
  }

  async adminFindBookingById(
    userId: string,
    bookingId: string
  ): Promise<CreateBookingWithScooterPoolResponse> {
    try {
      // Fetch user account type
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          accountType: true,
          institutionMember: { include: { institution: true } },
        },
      })

      // Check if user is InstitutionMember
      if (user.accountType === AccountType.InstitutionMember) {
        const booking = await this.prisma.booking.findFirstOrThrow({
          where: {
            id: bookingId,
            customer: {
              institutionId: user.institutionMember.institutionId, // Ensure booking belongs to the same institution
            },
          },
          include: {
            scooter: { include: { scooterPool: true } },
            customer: { include: { user: true } },
          },
        })
        return booking
      }

      // If user is Admin, fetch booking without restrictions
      return await this.prisma.booking.findFirstOrThrow({
        where: { id: bookingId },
        include: {
          scooter: { include: { scooterPool: true } },
          customer: { include: { user: true } },
        },
      })
    } catch (error) {
      if (error.code === 'P2025') {
        throw new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      }

      throw new StandardError(
        ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }
  async findBookingById(
    userId: string,
    bookingId: string,
    includeScooter: boolean
  ): Promise<CreateBookingWithScooterPoolResponse> {
    try {
      return await this.prisma.booking.findFirstOrThrow({
        where: {
          id: bookingId,
          customer: {
            userId,
          },
        },
        include: {
          scooter: includeScooter ? { include: { scooterPool: true } } : false,
          customer: {
            include: {
              user: true,
            },
          },
        },
      })
    } catch (error) {
      if (error.code === 'P2025') {
        throw new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      }

      throw new StandardError(
        ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  async findByUserId(
    userId: string,
    includeScooter: boolean,
    sortOrder: string,
    status: BookingStatus[]
  ) {
    // Default to open bookings if no status is provided and filter our invalid status
    if (status) {
      const validStatus = status.filter((s) =>
        Object.values(BookingStatus).includes(s)
      )
      status = validStatus as BookingStatus[]
    } else {
      status = [BookingStatus.Open]
    }

    return this.prisma.booking.findMany({
      where: {
        bookingStatus: { in: status as BookingStatus[] },
        bookingDate: {
          gte: DateHelper.getClosestHourMark(),
        },
        customer: {
          userId,
        },
      },
      ...(includeScooter && {
        include: {
          scooter: {
            include: {
              scooterPool: true,
            },
          },
        },
      }),
      orderBy: {
        bookingDate: sortOrder as Prisma.SortOrder,
      },
    })
  }

  async cancelBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: {
        id: bookingId,
        customer: {
          userId, // Ensure the booking belongs to the user
        },
      },
    })

    if (!booking) {
      throw new StandardError(
        ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
        ErrorCode.BOOKING_NOT_FOUND,
        HttpStatus.NOT_FOUND
      )
    }

    // Check if the booking status is not OPEN
    if (booking.bookingStatus !== BookingStatus.Open) {
      throw new StandardError(
        ErrorMessage[ErrorCode.INVALID_BOOKING_REQUEST],
        ErrorCode.INVALID_BOOKING_REQUEST,
        HttpStatus.CONFLICT
      )
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { bookingStatus: BookingStatus.Cancelled },
    })

    return {
      message: 'Booking successfully cancelled',
    }
  }

  async adminCancelBooking(bookingId: string, userId: string) {
    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId },
      include: { institutionMember: true },
    })

    const booking = await this.prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
      include: {
        customer: true,
      },
    })

    if (!booking) {
      throw new StandardError(
        ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
        ErrorCode.BOOKING_NOT_FOUND,
        HttpStatus.NOT_FOUND
      )
    }

    // if request is from institution member, check if booking is from same institution
    if (
      user.accountType !== AccountType.Admin &&
      booking.customer.institutionId !== user.institutionMember.institutionId
    ) {
      throw new StandardError(
        ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
        ErrorCode.BOOKING_NOT_FOUND,
        HttpStatus.NOT_FOUND
      )
    }

    // Check if the booking status is not OPEN
    if (booking.bookingStatus !== BookingStatus.Open) {
      throw new StandardError(
        ErrorMessage[ErrorCode.INVALID_BOOKING_REQUEST],
        ErrorCode.INVALID_BOOKING_REQUEST,
        HttpStatus.CONFLICT
      )
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { bookingStatus: BookingStatus.Cancelled },
    })

    return {
      message: 'Booking successfully cancelled',
    }
  }

  private async getCurrentTimeDurations(
    scooterPoolId: string,
    bookingDateToCheck: Date
  ): Promise<AvailableDuration[]> {
    const availableDurations: AvailableDuration[] = []

    for (const duration of DurationOptions) {
      let isAvailable = false

      const bookingDateHours = bookingDateToCheck.getHours()
      const bookingEndHours = bookingDateHours + Number(duration) / 60

      if (
        bookingDateHours >= this.BOOKING_START_TIME_BLOCK &&
        bookingEndHours <= this.BOOKING_END_TIME_BLOCK
      ) {
        const scooter = await this.findAvailableScooter(
          scooterPoolId,
          bookingDateToCheck,
          duration
        )

        isAvailable = !!scooter
      }

      availableDurations.push({
        duration,
        startingTime: DateHelper.formatHour(bookingDateHours),
        endingTime: DateHelper.formatHour(bookingEndHours),
        available: isAvailable,
      })
    }

    return availableDurations
  }

  private async getBookingDateDurations(
    customerId: string,
    scooterPoolId: string,
    bookingDate: string
  ): Promise<AvailableDuration[]> {
    const availableDurations: AvailableDuration[] = []
    const dateToFetch = new Date(bookingDate)

    if (isNaN(dateToFetch.getTime())) {
      throw new StandardError(
        ErrorMessage[ErrorCode.INVALID_INPUT],
        ErrorCode.INVALID_INPUT,
        HttpStatus.BAD_REQUEST
      )
    }

    const scootersAndBookings = await this.getScootersAndBookingsByDate(
      customerId,
      scooterPoolId,
      bookingDate
    )

    const bookingStartTimeBlock = BookingHelper.getBookingStartTimeBlock(
      dateToFetch,
      this.BOOKING_START_TIME_BLOCK
    )

    for (const duration of DurationOptions) {
      let availableTimeslots = []

      // If start time block is after end time block, return empty array
      if (bookingStartTimeBlock <= this.BOOKING_END_TIME_BLOCK) {
        availableTimeslots = BookingHelper.calculateAvailableTimeSlots(
          dateToFetch,
          customerId,
          scootersAndBookings,
          bookingStartTimeBlock,
          this.BOOKING_END_TIME_BLOCK,
          duration
        )
      }

      availableDurations.push({
        duration,
        startingTime: '',
        endingTime: '',
        available: availableTimeslots.length > 0 ? true : false,
      })
    }

    return availableDurations
  }

  // This function is used to get available durations for a booking
  private async getBookingIdAvailableDurations(
    userId: string,
    bookingId: string
  ): Promise<AvailableDuration[]> {
    const availableDurations: AvailableDuration[] = []

    const { bookingDate: bookingDateToCheck, scooterId } =
      await this.findBookingById(userId, bookingId, true)

    for (const duration of DurationOptions) {
      let isAvailable = false

      const bufferedStartTime = new Date(
        bookingDateToCheck.getTime() - this.END_TIME_BUFFER * 60000
      )
      const endTime = new Date(
        bookingDateToCheck.getTime() + (duration + this.END_TIME_BUFFER) * 60000
      )

      const bookingDateHours = bookingDateToCheck.getHours()
      const bookingEndHours = bookingDateHours + Number(duration) / 60

      if (
        bookingDateHours >= this.BOOKING_START_TIME_BLOCK &&
        bookingEndHours <= this.BOOKING_END_TIME_BLOCK
      ) {
        const scooter = await this.prisma.scooter.findFirst({
          where: {
            id: scooterId,
            NOT: {
              OR: [
                {
                  status: ScooterStatus.Unavailable,
                },
                {
                  booking: {
                    some: {
                      NOT: {
                        bookingStatus: BookingStatus.Cancelled,
                      },
                      AND: [
                        { id: { not: bookingId } },
                        { bookingDate: { gte: bufferedStartTime } },
                        { bookingEndDate: { lte: endTime } },
                      ],
                    },
                  },
                },
              ],
            },
          },
        })

        isAvailable = !!scooter
      }

      availableDurations.push({
        duration,
        startingTime: DateHelper.formatHour(bookingDateHours),
        endingTime: DateHelper.formatHour(bookingEndHours),
        available: isAvailable,
      })
    }

    return availableDurations
  }

  async getAvailableDuration(
    userId: string,
    scooterPoolId: string,
    bookingDate?: string,
    bookingId?: string
  ): Promise<AvailableDuration[]> {
    try {
      const user = await this.userService.findUserById(userId, true)

      let availableDurations: AvailableDuration[] = []

      if (bookingId) {
        availableDurations = await this.getBookingIdAvailableDurations(
          user.customer.userId,
          bookingId
        )
      } else if (bookingDate) {
        availableDurations = await this.getBookingDateDurations(
          user.customer?.id,
          scooterPoolId,
          bookingDate
        )
      } else {
        availableDurations = await this.getCurrentTimeDurations(
          scooterPoolId,
          new Date()
        )
      }

      return availableDurations
    } catch (error) {
      if (error instanceof StandardError) {
        throw error
      }

      this.logger.error(error)
      throw new StandardError(
        ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  async getAvailableTimeSlots(
    userId: string,
    duration: number,
    scooterPoolId: string,
    bookingDate: string
  ): Promise<AvailableTimeslots[]> {
    try {
      const dateToFetch = new Date(bookingDate)

      if (isNaN(dateToFetch.getTime())) {
        throw new StandardError(
          ErrorMessage[ErrorCode.INVALID_INPUT],
          ErrorCode.INVALID_INPUT,
          HttpStatus.BAD_REQUEST
        )
      }

      const user = await this.userService.findUserById(userId, true)

      const scootersAndBookings = await this.getScootersAndBookingsByDate(
        user.customer?.id,
        scooterPoolId,
        bookingDate
      )

      const bookingStartTimeBlock = BookingHelper.getBookingStartTimeBlock(
        dateToFetch,
        this.BOOKING_START_TIME_BLOCK
      )

      // If start time block is after end time block, return empty array
      if (bookingStartTimeBlock >= this.BOOKING_END_TIME_BLOCK) {
        return []
      }

      return BookingHelper.calculateAvailableTimeSlots(
        dateToFetch,
        user.customer?.id,
        scootersAndBookings,
        bookingStartTimeBlock,
        this.BOOKING_END_TIME_BLOCK,
        duration
      )
    } catch (error) {
      if (error instanceof StandardError) {
        throw error
      }

      this.logger.error(error)
      throw new StandardError(
        ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  async getScootersAndBookingsByDate(
    customerId: string,
    scooterPoolId: string,
    bookingDate: string
  ): Promise<ScooterDetails[]> {
    try {
      const startDate = new Date(bookingDate)
      startDate.setHours(0, 0, 0, 0)

      const endDate = new Date(bookingDate)
      endDate.setHours(23, 59, 59, 999)

      const customerScooters = await this.prisma.customerScooterPool.findMany({
        where: {
          scooterPoolId,
          customerId,
        },
        include: {
          scooterPool: {
            include: {
              scooters: {
                where: {
                  NOT: {
                    status: ScooterStatus.Unavailable,
                  },
                },
                include: {
                  booking: {
                    where: {
                      bookingStatus: {
                        not: BookingStatus.Cancelled,
                      },
                      OR: [
                        { bookingDate: { gte: startDate, lt: endDate } },
                        { bookingEndDate: { gte: startDate, lt: endDate } },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      })

      const scootersAndBookings: ScooterDetails[] = []

      for (const customerScooter of customerScooters) {
        const scooterPool = customerScooter.scooterPool
        const scooters = scooterPool.scooters

        for (const scooter of scooters) {
          const bookings = scooter.booking

          scootersAndBookings.push({
            ...scooter,
            booking: bookings,
          })
        }
      }

      return scootersAndBookings
    } catch (error) {
      this.logger.error(error)

      throw new StandardError(
        ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR
      )
    }
  }

  async updateBooking(
    userId: string,
    id: string,
    updateBookingDto: UpdateBookingDto
  ) {
    try {
      //only duration will be updateable
      const existingBooking = await this.prisma.booking.findFirstOrThrow({
        where: { id },
        include: { scooter: true },
      })

      if (!existingBooking) {
        //booking id required and scooter id is required (booking without a scooter should be impossible)
        throw new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      }

      //check booking status
      if (existingBooking.bookingStatus !== BookingStatus.Open) {
        throw new StandardError(
          ErrorMessage[ErrorCode.INVALID_BOOKING_REQUEST],
          ErrorCode.INVALID_BOOKING_REQUEST,
          HttpStatus.CONFLICT
        )
      }

      //check if user is valid
      const user = await this.userService.findUserById(userId, true)
      if (!user?.customer) {
        throw new StandardError(
          ErrorMessage[ErrorCode.USER_NOT_FOUND],
          ErrorCode.USER_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      } else if (user.status !== UserStatus.Active) {
        throw new StandardError(
          ErrorMessage[ErrorCode.INACTIVE_USER],
          ErrorCode.INACTIVE_USER,
          HttpStatus.FORBIDDEN
        )
      }

      //check if booking will be valid
      this.validateBookingHours({
        bookingDate: existingBooking.bookingDate,
        bookingType: existingBooking.bookingType,
        duration: updateBookingDto.duration,
        scooterPoolId: existingBooking.scooter.scooterPoolId,
      })

      // Add a buffer time of 1 hr for both start and end time this will ensure that the scooter is available in consideration for late return
      const bufferedStartTime = new Date(
        existingBooking.bookingDate.getTime() - this.END_TIME_BUFFER * 60000
      )
      const endTime = new Date(
        existingBooking.bookingDate.getTime() +
          (updateBookingDto.duration + this.END_TIME_BUFFER) * 60000
      )
      //check if there's a booking with the same scooter within new duration range
      const conflictingBooking = await this.prisma.booking.findMany({
        where: {
          scooterId: existingBooking.scooterId,
          OR: [
            { bookingDate: { gte: bufferedStartTime, lte: endTime } },
            { bookingEndDate: { gte: bufferedStartTime, lte: endTime } },
          ],
          AND: {
            OR: [{ bookingStatus: 'Open' }, { bookingStatus: 'Ongoing' }],
            NOT: {
              id: existingBooking.id,
            },
          },
        },
      })
      //if conflicting booking exists, throw error
      if (conflictingBooking.length) {
        throw new StandardError(
          ErrorMessage[ErrorCode.UPDATE_BOOKING_SCOOTER_CONFLICT],
          ErrorCode.UPDATE_BOOKING_SCOOTER_CONFLICT,
          HttpStatus.CONFLICT
        )
      }

      //update duration and new calculated bookingEndDate
      const booking = await this.prisma.booking.update({
        where: { id },
        data: {
          duration: updateBookingDto.duration,
          bookingEndDate: new Date(
            existingBooking.bookingDate.getTime() +
              updateBookingDto.duration * 60000
          ),
        },
        include: {
          scooter: { include: { scooterPool: true } },
        },
      })
      return booking
    } catch (error) {
      // Catch NotFound error to throw correct error code
      if (error.code === 'P2025') {
        throw new StandardError(
          ErrorMessage[ErrorCode.BOOKING_NOT_FOUND],
          ErrorCode.BOOKING_NOT_FOUND,
          HttpStatus.NOT_FOUND
        )
      } else if (error instanceof StandardError) {
        throw error
      }

      this.logger.error(error)
      throw new StandardError(
        ErrorMessage[ErrorCode.INTERNAL_SERVER_ERROR],
        ErrorCode.INTERNAL_SERVER_ERROR,
        HttpStatus.UNAUTHORIZED
      )
    }
  }

  public async checkConflictingBooking(
    scooterId: string,
    bufferedStartTime: Date,
    endTime: Date,
    bookingId: string
  ) {
    const conflictingBooking = await this.prisma.booking.findMany({
      where: {
        scooterId: scooterId,
        OR: [
          { bookingDate: { gte: bufferedStartTime, lte: endTime } },
          { bookingEndDate: { gte: bufferedStartTime, lte: endTime } },
        ],
        AND: {
          OR: [{ bookingStatus: 'Open' }, { bookingStatus: 'Ongoing' }],
          NOT: {
            id: bookingId,
          },
        },
      },
    })
    //if conflicting booking exists, throw error
    if (conflictingBooking.length) {
      throw new StandardError(
        ErrorMessage[ErrorCode.UPDATE_BOOKING_SCOOTER_CONFLICT],
        ErrorCode.UPDATE_BOOKING_SCOOTER_CONFLICT,
        HttpStatus.CONFLICT
      )
    }
  }
}
