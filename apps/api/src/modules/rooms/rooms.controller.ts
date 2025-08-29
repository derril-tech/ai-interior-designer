import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Rooms')
@Controller('rooms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RoomsController {
    constructor(private readonly roomsService: RoomsService) { }

    @Get(':id')
    @ApiOperation({ summary: 'Get room by ID' })
    async findOne(@Param('id') id: string) {
        return this.roomsService.findOne(id);
    }

    @Post(':id/scan')
    @ApiOperation({ summary: 'Upload room scan data' })
    async uploadScan(@Param('id') id: string, @Body() scanData: any) {
        return { message: 'Scan upload endpoint - to be implemented' };
    }
}
