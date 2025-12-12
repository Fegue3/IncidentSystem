import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ListServicesDto } from './dto/list-services.dto';

@Controller('services')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  // GET /services?isActive=true&q=auth
  @Get()
  list(@Query() query: ListServicesDto) {
    return this.services.list(query);
  }

  // GET /services/id/:id
  @Get('id/:id')
  getById(@Param('id') id: string) {
    return this.services.getById(id);
  }

  // GET /services/key/:key
  @Get('key/:key')
  getByKey(@Param('key') key: string) {
    return this.services.getByKey(key);
  }
}
