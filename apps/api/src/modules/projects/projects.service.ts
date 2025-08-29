import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createProjectDto: CreateProjectDto, userId: string) {
        return this.prisma.project.create({
            data: {
                ...createProjectDto,
                userId,
            },
        });
    }

    async findAllByUser(userId: string) {
        return this.prisma.project.findMany({
            where: { userId },
            include: {
                rooms: {
                    select: {
                        id: true,
                        name: true,
                        areaSqm: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string, userId: string) {
        const project = await this.prisma.project.findFirst({
            where: { id, userId },
            include: {
                rooms: true,
            },
        });

        if (!project) {
            throw new NotFoundException('Project not found');
        }

        return project;
    }
}
