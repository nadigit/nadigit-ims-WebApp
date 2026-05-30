import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { ProcessModeService } from '../services/process-mode.service';

@Injectable({ providedIn: 'root' })
export class PosEnabledGuard implements CanActivate {

  constructor(
    private processModeService: ProcessModeService,
    private router: Router,
  ) {}

  async canActivate(): Promise<boolean> {
    await this.processModeService.ensureLoaded();
    if (this.processModeService.posEnabled) {
      return true;
    }
    await this.router.navigate(['/profile']);
    return false;
  }
}
