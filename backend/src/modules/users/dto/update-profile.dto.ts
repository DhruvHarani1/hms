import { IsInt, IsOptional, IsString } from 'class-validator';

/** All profile fields a student can edit. All optional (partial updates). */
export class UpdateProfileDto {
  // On the User record
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phone?: string; // mobile number
  @IsOptional() @IsString() avatarUrl?: string;

  // On StudentProfile
  @IsOptional() @IsString() fatherName?: string;
  @IsOptional() @IsString() surname?: string;
  @IsOptional() @IsString() rollNo?: string;
  @IsOptional() @IsString() course?: string;
  @IsOptional() @IsInt() year?: number;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() instituteName?: string;
  @IsOptional() @IsString() instituteAddress?: string;
  @IsOptional() @IsString() guardianName?: string;
  @IsOptional() @IsString() guardianPhone?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() roomNumber?: string;
  @IsOptional() @IsString() dob?: string; // ISO date
  @IsOptional() @IsString() admissionDate?: string; // ISO date

  // R2 object keys (set after a successful upload)
  @IsOptional() @IsString() photoKey?: string;
  @IsOptional() @IsString() aadhaarKey?: string;
  @IsOptional() @IsString() courseProofKey?: string;
}
