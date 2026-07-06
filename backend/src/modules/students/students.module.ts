import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StudentsController } from './students.controller';
import { StudentPdfService } from './student-pdf.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [JwtModule.register({}), UploadsModule],
  controllers: [StudentsController],
  providers: [StudentPdfService],
})
export class StudentsModule {}
