import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StudentsController } from './students.controller';
import { StudentPdfService } from './student-pdf.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [StudentsController],
  providers: [StudentPdfService],
})
export class StudentsModule {}
