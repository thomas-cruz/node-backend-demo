import { UsersService } from '@/modules/api/users/users.service'
import {
  Controller,
  Get,
  Param,
} from '@nestjs/common'

@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  @Get('/:id')
  findById(@Param('id') id: string) {
    return this.userService.findUserById(id)
  }
}
