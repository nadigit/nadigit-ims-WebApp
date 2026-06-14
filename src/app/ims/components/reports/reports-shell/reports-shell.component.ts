import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
  selector: 'app-reports-shell',
  templateUrl: './reports-shell.component.html',
  styleUrls: ['./reports-shell.component.css']
})
export class ReportsShellComponent implements OnInit {
  constructor(
    private translate: TranslateService,
    private translationService: TranslationService,
  ) {}

  ngOnInit(): void {
    this.translationService.currentLanguage$.subscribe(() =>
      this.translate.use(this.translationService.getPreferredLanguage())
    );
  }
}
