import { Module } from '@nestjs/common'
import { UsersService } from '@/modules/api/users/users.service'
import { UsersController } from '@/modules/api/users/users.controller'


@Module({
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
