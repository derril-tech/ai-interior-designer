import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LayoutsService {
    constructor(private readonly prisma: PrismaService) { }

    async generate(generateLayoutDto: any) {
        return { message: 'Layout generation - to be implemented', data: generateLayoutDto };
    }

    async findOne(id: string) {
        return { message: 'Layout service - to be implemented', id };
    }
}
