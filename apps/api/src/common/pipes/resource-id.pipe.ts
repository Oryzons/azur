import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Identifiant route (UUID ou id métier type pp_season_basse). */
@Injectable()
export class ResourceIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    const s = String(value ?? '').trim();
    if (!s || s.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(s)) {
      throw new BadRequestException('Identifiant invalide.');
    }
    return s;
  }
}
