import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { RentalContractsService } from './rental-contracts.service';

@Controller('public/rental-contracts')
export class PublicRentalContractsController {
  constructor(private readonly contracts: RentalContractsService) {}

  @Public()
  @Get(':token')
  getByToken(@Param('token') token: string) {
    return this.contracts.getPublicByToken(token);
  }

  @Public()
  @Post(':token/sign')
  @HttpCode(200)
  sign(@Param('token') token: string, @Body() body: unknown) {
    return this.contracts.signByToken(token, body);
  }

  @Public()
  @Get(':token/download')
  async downloadSignedPdf(@Param('token') token: string, @Res() res: Response) {
    const { pdf, filename } = await this.contracts.getSignedPdfByToken(token);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }
}
