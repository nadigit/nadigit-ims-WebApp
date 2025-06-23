import { Component, Input, OnInit } from '@angular/core';
import { LayoutService } from '../service/app.layout.service';
import { MenuService } from '../app.menu.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
    selector: 'app-config',
    templateUrl: './app.config.component.html',
})
export class AppConfigComponent implements OnInit {
    @Input() minimal: boolean = false;

    scales: number[] = [12, 13, 14, 15, 16];
    isDarkMode: boolean = false;
    menuType: string = 'static'; // Default menu type

    constructor(
        public layoutService: LayoutService,
        public menuService: MenuService,
        private translate: TranslateService,
        private translateService: TranslationService,
    ) {
        this.translateService.currentLanguage$.subscribe(lang => {
            this.translate.use(lang); // Use the translate service to update language
          });
    }

    ngOnInit() {
        // Retrieve and apply dark mode preference from localStorage
        const savedMode = localStorage.getItem('darkMode');
        const savedMenuType = localStorage.getItem('menuType');
        const savedScale = localStorage.getItem('scale');


        this.isDarkMode = savedMode === 'dark';
        this.menuType = savedMenuType || 'static'; // Default to 'static' if not set
        this.scale = savedScale ? +savedScale : 14; // Default to 14 if not set


        // Apply the theme based on the saved preference
        this.changeTheme(
            this.isDarkMode ? 'lara-dark-indigo' : 'lara-light-indigo',
            this.isDarkMode ? 'dark' : 'light'
        );

        this.menuMode = this.menuType;

    }

    get visible(): boolean {
        return this.layoutService.state.configSidebarVisible;
    }
    set visible(_val: boolean) {
        this.layoutService.state.configSidebarVisible = _val;
    }

    get scale(): number {
        return this.layoutService.config().scale;
    }
    set scale(_val: number) {
        this.layoutService.config.update((config) => ({
            ...config,
            scale: _val,
        }));

        // Save the updated scale to localStorage
        localStorage.setItem('scale', _val.toString());
    }

    get menuMode(): string {
        return this.layoutService.config().menuMode;
    }
    set menuMode(_val: string) {
        this.layoutService.config.update((config) => ({
            ...config,
            menuMode: _val,
        }));

        // Save the menu type to localStorage
        localStorage.setItem('menuType', _val);
    }

    get inputStyle(): string {
        return this.layoutService.config().inputStyle;
    }
    set inputStyle(_val: string) {
        this.layoutService.config().inputStyle = _val;
    }

    get ripple(): boolean {
        return this.layoutService.config().ripple;
    }
    set ripple(_val: boolean) {
        this.layoutService.config.update((config) => ({
            ...config,
            ripple: _val,
        }));
    }

    set theme(val: string) {
        this.layoutService.config.update((config) => ({
            ...config,
            theme: val,
        }));
    }
    get theme(): string {
        return this.layoutService.config().theme;
    }

    set colorScheme(val: string) {
        this.layoutService.config.update((config) => ({
            ...config,
            colorScheme: val,
        }));
    }
    get colorScheme(): string {
        return this.layoutService.config().colorScheme;
    }

    onConfigButtonClick() {
        this.layoutService.showConfigSidebar();
    }

    changeTheme(theme: string, colorScheme: string) {
        this.theme = theme;
        this.colorScheme = colorScheme;
        localStorage.setItem('darkMode', colorScheme === 'dark' ? 'dark' : 'light');
    }

    decrementScale() {
        this.scale--;
    }

    incrementScale() {
        this.scale++;
    }
}
