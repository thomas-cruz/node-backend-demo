import { IsInt } from '@nestjs/class-validator'
export class UpdateBookingDto {
  @IsInt()
  duration: number
}
