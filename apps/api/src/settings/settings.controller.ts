import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DeskOnly } from '../common/decorators/role-groups.decorator';
import { RentalContractsService } from '../rental-contracts/rental-contracts.service';
import { SettingsService } from './settings.service';
import {
  CreateContractDto,
  CreatePartnerDto,
  UpdateContractDto,
  UpdatePartnerDto,
  UpdateSettingsDto,
} from './settings.dto';

@Controller()
@DeskOnly()
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly rentalContracts: RentalContractsService,
  ) {}

  @Get('settings')
  getAll() {
    return this.settings.getAll();
  }

  @Patch('settings')
  update(@Body() body: UpdateSettingsDto) {
    return this.settings.update(body);
  }

  @Get('partners')
  listPartners() {
    return this.settings.listPartners();
  }

  @Post('partners')
  createPartner(@Body() body: CreatePartnerDto) {
    return this.settings.createPartner(body);
  }

  @Patch('partners/:id')
  updatePartner(@Param('id') id: string, @Body() body: UpdatePartnerDto) {
    return this.settings.updatePartner(id, body);
  }

  @Delete('partners/:id')
  removePartner(@Param('id') id: string) {
    return this.settings.removePartner(id);
  }

  @Get('contracts')
  listContracts() {
    return this.settings.listContracts();
  }

  @Get('contracts/default-template')
  getDefaultContractTemplate() {
    return this.settings.getDefaultContractTemplateTexts();
  }

  @Post('contracts/:id/apply-default-template')
  applyDefaultContractTemplate(@Param('id') id: string) {
    return this.settings.applyDefaultContractTemplate(id);
  }

  @Get('contracts/:id/preview')
  async previewContract(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { pdf, filename } = await this.rentalContracts.getPreviewPdfForTemplate(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdf);
  }

  @Post('contracts')
  createContract(@Body() body: CreateContractDto) {
    return this.settings.createContract(body);
  }

  @Patch('contracts/:id')
  updateContract(@Param('id') id: string, @Body() body: UpdateContractDto) {
    return this.settings.updateContract(id, body);
  }

  @Delete('contracts/:id')
  removeContract(@Param('id') id: string) {
    return this.settings.removeContract(id);
  }
}
