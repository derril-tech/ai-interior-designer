import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProjectsController {
    constructor(private readonly projectsService: ProjectsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new project' })
    async create(@Body() createProjectDto: CreateProjectDto, @Request() req: any) {
        return this.projectsService.create(createProjectDto, req.user.id);
    }

    @Get()
    @ApiOperation({ summary: 'Get all user projects' })
    async findAll(@Request() req: any) {
        return this.projectsService.findAllByUser(req.user.id);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get project by ID' })
    async findOne(@Param('id') id: string, @Request() req: any) {
        return this.projectsService.findOne(id, req.user.id);
    }
}
