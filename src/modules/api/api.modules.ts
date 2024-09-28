import { Module } from '@nestjs/common'
import { BookingsModule } from '@/modules/api/bookings/bookings.module'

@Module({
  imports: [
    BookingsModule,
  ],
})
export class ApiModules {}
