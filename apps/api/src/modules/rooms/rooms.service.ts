import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
    constructor(private readonly prisma: PrismaService) { }

    async findOne(id: string) {
        return { message: 'Room service - to be implemented', id };
    }
}
