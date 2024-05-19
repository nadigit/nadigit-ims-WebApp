import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { Location } from '@angular/common';

@Component({
    selector: 'app-error',
    templateUrl: './error.component.html',
})
export class ErrorComponent implements OnInit{ 
    constructor(private translate: TranslateService,
        private translateService: TranslationService,
        private location: Location){

    }
    ngOnInit() {
        this.translateService.currentLanguage$.subscribe(lang => {
            this.translate.use(lang); // Use the translate service to update language
          });
    }
    goBack(): void {
        this.location.back();
      }
}