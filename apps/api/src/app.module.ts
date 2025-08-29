import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { LayoutsModule } from './modules/layouts/layouts.module';
import { ProductsModule } from './modules/products/products.module';
import { PrismaModule } from './modules/prisma/prisma.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ThrottlerModule.forRoot([
            {
                ttl: 60000,
                limit: 100,
            },
        ]),
        PrismaModule,
        AuthModule,
        ProjectsModule,
        RoomsModule,
        LayoutsModule,
        ProductsModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule { }
