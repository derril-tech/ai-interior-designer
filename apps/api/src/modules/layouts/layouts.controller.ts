import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LayoutsService } from './layouts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Layouts')
@Controller('layouts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LayoutsController {
    constructor(private readonly layoutsService: LayoutsService) { }

    @Post('generate')
    @ApiOperation({ summary: 'Generate layout variants for a room' })
    async generate(@Body() generateLayoutDto: any) {
        return this.layoutsService.generate(generateLayoutDto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get layout by ID' })
    async findOne(@Param('id') id: string) {
        return this.layoutsService.findOne(id);
    }
}
