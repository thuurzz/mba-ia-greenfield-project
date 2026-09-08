import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateChannelDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]+$/)
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsString()
  description?: string;
}