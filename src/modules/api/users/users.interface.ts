import { User, Customer, Admin, InstitutionMember } from '@prisma/client'

export interface BaseUserModel extends User {
  customer?: Customer
  admin?: Admin
  institutionMember?: InstitutionMember
}
