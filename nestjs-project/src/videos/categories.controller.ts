import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('categories')
export class CategoriesController {
  constructor(private categoriesService: CategoriesService) {}

  @Public()
  @Get()
  async findAll() {
    return this.categoriesService.findAll();
  }
}