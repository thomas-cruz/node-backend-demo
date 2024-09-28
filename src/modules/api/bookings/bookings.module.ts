import { Module } from '@nestjs/common'
import { BookingsService } from '@/modules/api/bookings/bookings.service'
import { BookingsController } from '@/modules/api/bookings/bookings.controller'
import { UsersModule } from '@/modules/api/users/users.module'

@Module({
  imports: [UsersModule],
  providers: [BookingsService],
  exports: [BookingsService],
  controllers: [BookingsController],
})
export class BookingsModule {}
