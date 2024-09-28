import { GetUserId } from '@/libs/decorators/user.decorator'
import {
  AvailableTimeslots,
  CreateBookingWithScooterPoolResponse,
} from '@/modules/api/bookings/bookings.interface'
import { BookingsService } from '@/modules/api/bookings/bookings.service'
import { CreateBookingDto } from '@/modules/api/bookings/dto/create-booking.dto'
import { UpdateBookingDto } from '@/modules/api/bookings/dto/update-booking.dto'
import {
  Body,
  Controller,
  Get,
  Param,
  ParseArrayPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { BookingStatus } from '@prisma/client'

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('/admin')
  findAll(
    @GetUserId() userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ) {
    return this.bookingsService.findAll({
      search,
      ...(page && { page: parseInt(page) }),
      ...(limit && { limit: parseInt(limit) }),
      sortBy,
      sortOrder,
      userId,
    })
  }

  // Only get bookings made by user
  @Get('/')
  /**
   * Finds bookings by user ID.
   *
   * @param id - The user ID.
   * @param includeScooter - Whether to include scooter information.
   * @param sortOrder - The sort order for the bookings.
   * @param status - The status of the bookings. We will accept multiple string status values
   * separated by comma and parse each item into an array.
   *
   * @returns The bookings found for the user.
   */
  findByUserId(
    @GetUserId() id: string,
    @Query('sortOrder') sortOrder: string,
    @Query(
      'status',
      new ParseArrayPipe({
        items: String,
        separator: ',',
        optional: true,
      })
    )
    status: BookingStatus[]
  ) {
    // Getting user id from auth token
    return this.bookingsService.findByUserId(
      id,
      true,
      sortOrder,
      status
    )
  }

  @Get('/admin/:bookingId')
  adminFindBookingById(
    @GetUserId() userId: string,
    @Param('bookingId') bookingId: string
  ) {
    return this.bookingsService.adminFindBookingById(userId, bookingId)
  }

  @Get('/:id/info')
  findByBookingId(@GetUserId() userId: string, @Param('id') id: string) {
    return this.bookingsService.findBookingById(userId, id, true)
  }

  @Patch('/:id')
  updateBooking(
    @GetUserId() userId: string,
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto
  ) {
    return this.bookingsService.updateBooking(userId, id, updateBookingDto)
  }

  @Post('/')
  createBooking(
    @GetUserId() userId,
    @Body() createBookingDto: CreateBookingDto
  ): Promise<CreateBookingWithScooterPoolResponse> {
    return this.bookingsService.reserveScooter(userId, createBookingDto)
  }

  @Post('/:bookingId/cancel')
  cancelBooking(
    @Param('bookingId') bookingId: string,
    @GetUserId() userId: string
  ) {
    return this.bookingsService.cancelBooking(bookingId, userId)
  }

  @Get('/available-timeslots/:duration/:scooterPoolId')
  getAvailableTimeSlots(
    @GetUserId() userId: string,
    @Param('duration') duration: number,
    @Param('scooterPoolId') scooterPoolId: string,
    @Query('bookingDate') bookingDate: string
  ): Promise<AvailableTimeslots[]> {
    return this.bookingsService.getAvailableTimeSlots(
      userId,
      duration,
      scooterPoolId,
      bookingDate
    )
  }

  @Get('/available-duration/:scooterPoolId')
  getAvailableDuration(
    @GetUserId() userId: string,
    @Param('scooterPoolId') scooterPoolId: string,
    @Query('bookingDate') bookingDate?: string,
    @Query('bookingId') bookingId?: string
  ) {
    return this.bookingsService.getAvailableDuration(
      userId,
      scooterPoolId,
      bookingDate,
      bookingId
    )
  }

  @Post('/admin/:bookingId/cancel')
  adminCancelBooking(
    @Param('bookingId') bookingId: string,
    @GetUserId() userId: string
  ) {
    return this.bookingsService.adminCancelBooking(bookingId, userId)
  }
}
