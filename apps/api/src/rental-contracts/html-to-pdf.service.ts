import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';

@Injectable()
export class HtmlToPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(HtmlToPdfService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    if (this.launching) return this.launching;

    this.launching = puppeteer
      .launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      .then((b) => {
        this.browser = b;
        this.launching = null;
        return b;
      })
      .catch((err) => {
        this.launching = null;
        throw err;
      });

    return this.launching;
  }

  async fromHtml(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      });
      return Buffer.from(pdf);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      this.logger.error(`Génération PDF échouée: ${msg}`);
      throw err;
    } finally {
      await page.close().catch(() => undefined);
    }
  }
}
