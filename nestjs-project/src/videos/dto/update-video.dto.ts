import { IsOptional, IsString, MaxLength, IsInt, IsPositive, IsEnum } from 'class-validator';
import { VideoVisibility } from '../video.entity';

export class UpdateVideoDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  category_id?: number;

  @IsOptional()
  @IsEnum(VideoVisibility)
  visibility?: VideoVisibility;
}