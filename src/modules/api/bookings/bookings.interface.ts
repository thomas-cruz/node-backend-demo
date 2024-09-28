import { Booking, Customer, Scooter, ScooterPool } from '@prisma/client'

export interface CreateBookingResponse extends Booking {
  scooter: Scooter
}
export interface CreateBookingWithScooterPoolResponse extends Booking {
  scooter: ScooterDetailsResponse
  customer?: Customer
}
export interface ScooterDetailsResponse extends Scooter {
  scooterPool?: ScooterPool
}

export interface ScooterDetails extends Scooter {
  booking: Booking[]
}

export interface AvailableDuration {
  duration: number
  startingTime: string
  endingTime: string
  available: boolean
}

export interface AvailableTimeslots {
  timeslot: string
  alreadyBooked: boolean
}
