import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreateProjectDto {
    @ApiProperty({ example: 'My Living Room Redesign' })
    @IsString()
    title: string;

    @ApiProperty({ example: '123 Main St, Apt 4B', required: false })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({ example: 'USD', required: false })
    @IsOptional()
    @IsString()
    currency?: string;

    @ApiProperty({ example: ['modern', 'minimalist'], required: false })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    stylePrefs?: string[];

    @ApiProperty({ example: 500000, description: 'Budget in cents', required: false })
    @IsOptional()
    @IsNumber()
    budgetCents?: number;
}
