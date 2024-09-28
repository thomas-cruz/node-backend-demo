import { IsInt, IsDate } from '@nestjs/class-validator'
import { BookingType } from '@prisma/client'
import { Type } from 'class-transformer'
import { IsEnum, IsString } from 'class-validator'

export class CreateBookingDto {
  @IsDate()
  @Type(() => Date)
  bookingDate: Date

  @IsInt()
  duration: number

  @IsEnum(BookingType)
  bookingType: BookingType

  @IsString()
  scooterPoolId: string
}
