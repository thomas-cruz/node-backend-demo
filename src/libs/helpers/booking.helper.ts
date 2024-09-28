import {
  AvailableTimeslots,
  ScooterDetails,
} from '@/modules/api/bookings/bookings.interface'
import { Booking } from '@prisma/client'

export default class BookingHelper {
  public static getBookingStartTimeBlock(
    dateToFetch: Date,
    defaultBookingStartTime: number
  ): number {
    const currentDate = new Date()
    if (dateToFetch.toLocaleDateString() === currentDate.toLocaleDateString()) {
      const bookingStartTimeBlock = currentDate.getHours()
      if (bookingStartTimeBlock < defaultBookingStartTime) {
        return defaultBookingStartTime
      }
      return currentDate.getMinutes() > 0
        ? bookingStartTimeBlock + 1
        : bookingStartTimeBlock
    }

    return defaultBookingStartTime
  }

  public static calculateAvailableTimeSlots(
    dateToFetch: Date,
    customerId: string,
    scootersAndBookings: ScooterDetails[],
    bookingStartTimeBlock: number,
    bookingEndTimeBlock: number,
    duration: number
  ): AvailableTimeslots[] {
    const availableTimeSlots = []
    const userExistingBookedSlots = []

    const endBlock = new Date(dateToFetch)
    endBlock.setHours(bookingEndTimeBlock, 0, 0, 0)
    // Loop through all scooterPool scooters and their bookings
    for (const scooter of scootersAndBookings) {
      const bookings = scooter.booking
      let timeSlot = new Date(dateToFetch)
      timeSlot.setHours(bookingStartTimeBlock, 0, 0, 0)

      // Loop through all time slots from BOOKING_START_TIME_BLOCK to BOOKING_END_TIME_BLOCK
      while (timeSlot < endBlock) {
        const currentSlotStart = timeSlot
        const currentSlotEnd = new Date(timeSlot)
        currentSlotEnd.setMinutes(timeSlot.getMinutes() + duration)

        // Check if current slot overlaps with existing scooter bookings
        if (
          this.isTimeSlotAvailable(
            bookings,
            currentSlotStart,
            currentSlotEnd,
            bookingEndTimeBlock
          ) &&
          currentSlotEnd <= endBlock
        ) {
          availableTimeSlots.push(
            new Date(timeSlot).toLocaleTimeString('nl-NL', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            })
          )
        }

        if (
          this.isUserBookingExist(
            scooter.booking,
            currentSlotStart,
            currentSlotEnd,
            customerId
          )
        ) {
          userExistingBookedSlots.push(
            currentSlotStart.toLocaleTimeString('nl-NL', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
            })
          )
        }

        // Move to next time slot
        timeSlot = new Date(timeSlot.getTime() + 60 * 60000)
      }
    }

    return this.markAlreadyBookedTimeSlots(
      availableTimeSlots,
      userExistingBookedSlots
    )
  }

  public static isTimeSlotAvailable(
    bookings: Booking[],
    start: Date,
    end: Date,
    endTimeBuffer: number
  ): boolean {
    return !bookings.some((booking) => {
      const bookingDateWithBuffer = new Date(
        booking.bookingDate.getTime() - endTimeBuffer * 60000
      )
      const bookingEndDateWithBuffer = new Date(
        booking.bookingEndDate.getTime() + endTimeBuffer * 60000
      )

      return (
        (start >= bookingDateWithBuffer && start < bookingEndDateWithBuffer) ||
        (end > bookingDateWithBuffer && end <= bookingEndDateWithBuffer) ||
        (start <= bookingDateWithBuffer && end >= bookingEndDateWithBuffer)
      )
    })
  }

  public static markAlreadyBookedTimeSlots(
    availableTimeSlots: string[],
    userExistingBookedSlots: string[]
  ): AvailableTimeslots[] {
    const uniqueTimeSlots = Array.from(new Set(availableTimeSlots)).sort()
    return uniqueTimeSlots.map((slot) => ({
      timeslot: slot,
      alreadyBooked: userExistingBookedSlots.includes(slot),
    }))
  }

  public static isUserBookingExist(
    bookings: Booking[],
    start: Date,
    end: Date,
    customerId?: string
  ): boolean {
    return bookings.some(
      (booking) =>
        booking.customerId === customerId &&
        ((start >= booking.bookingDate && start < booking.bookingEndDate) ||
          (end > booking.bookingDate && end <= booking.bookingEndDate) ||
          (start <= booking.bookingDate && end >= booking.bookingEndDate))
    )
  }
}
