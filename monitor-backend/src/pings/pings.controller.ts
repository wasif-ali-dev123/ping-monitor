import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PingsGateway } from '../gateway/pings.gateway';
import { GetPingsQueryDto } from './dto/get-pings-query.dto';
import { PingsService } from './pings.service';

@Controller('pings')
export class PingsController {
  constructor(
    private readonly pingsService: PingsService,
    private readonly pingsGateway: PingsGateway,
  ) {}

  @Get()
  getHistory(@Query() query: GetPingsQueryDto) {
    return this.pingsService.getHistory(query.page, query.pageSize);
  }

  @Get('stats')
  getStats() {
    return this.pingsService.getStats();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const record = await this.pingsService.getById(id);
    if (!record) throw new NotFoundException('Ping record not found');
    return record;
  }

  @Post('trigger')
  @HttpCode(HttpStatus.CREATED)
  async triggerPing() {
    const record = await this.pingsService.executePing();
    this.pingsGateway.broadcastNewPing(record);
    return record;
  }
}
