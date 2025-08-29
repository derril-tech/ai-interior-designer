import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
    constructor(private readonly prisma: PrismaService) { }

    async search(query: string, roomId?: string) {
        return {
            message: 'Product search - to be implemented',
            query,
            roomId,
            results: []
        };
    }
}
