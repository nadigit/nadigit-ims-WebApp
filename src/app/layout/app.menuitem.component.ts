import { ChangeDetectorRef, Component, ElementRef, Host, HostBinding, HostListener, Input, OnDestroy, OnInit } from '@angular/core';
import { IsActiveMatchOptions, NavigationEnd, Router } from '@angular/router';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { MenuService } from './app.menu.service';
import { LayoutService } from './service/app.layout.service';

@Component({
    // eslint-disable-next-line @angular-eslint/component-selector
    selector: '[app-menuitem]',
    template: `
		<ng-container>
            <div *ngIf="root && item.visible !== false" class="layout-menuitem-root-header">
                <span class="layout-menuitem-root-text">{{item.label}}</span>
                <p-tag *ngIf="item.badge"
                    [value]="item.badge"
                    [severity]="item.badgeSeverity || 'info'"
                    styleClass="layout-menuitem-root-badge">
                </p-tag>
            </div>
			<a *ngIf="(!item.routerLink || item.items) && item.visible !== false" [attr.href]="item.url" (click)="itemClick($event)"
			   [ngClass]="item.class" [attr.target]="item.target" tabindex="0" pRipple
               [pTooltip]="item.label" [tooltipDisabled]="menuTooltipDisabled"
               [tooltipPosition]="menuTooltipPosition" [showDelay]="400">
				<i [ngClass]="item.icon" class="layout-menuitem-icon"></i>
				<span class="layout-menuitem-text">{{item.label}}</span>
                <p-tag *ngIf="item.badge && !root"
                    [value]="item.badge"
                    [severity]="item.badgeSeverity || 'info'"
                    styleClass="layout-menuitem-inline-badge">
                </p-tag>
				<i class="pi pi-fw pi-angle-down layout-submenu-toggler" *ngIf="item.items"></i>
			</a>
			<a *ngIf="(item.routerLink && !item.items) && item.visible !== false" (click)="itemClick($event)" [ngClass]="item.class" 
			   [routerLink]="item.routerLink" routerLinkActive="active-route" [routerLinkActiveOptions]="item.routerLinkActiveOptions||{ paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' }"
               [fragment]="item.fragment" [queryParamsHandling]="item.queryParamsHandling" [preserveFragment]="item.preserveFragment" 
               [skipLocationChange]="item.skipLocationChange" [replaceUrl]="item.replaceUrl" [state]="item.state" [queryParams]="item.queryParams"
               [attr.target]="item.target" tabindex="0" pRipple
               [pTooltip]="item.label" [tooltipDisabled]="menuTooltipDisabled"
               [tooltipPosition]="menuTooltipPosition" [showDelay]="400">
				<i [ngClass]="item.icon" class="layout-menuitem-icon"></i>
				<span class="layout-menuitem-text">{{item.label}}</span>
                <p-tag *ngIf="item.badge"
                    [value]="item.badge"
                    [severity]="item.badgeSeverity || 'info'"
                    styleClass="layout-menuitem-inline-badge">
                </p-tag>
				<i class="pi pi-fw pi-angle-down layout-submenu-toggler" *ngIf="item.items"></i>
			</a>

			<ul *ngIf="item.items && item.visible !== false" [@children]="submenuAnimation" [@.disabled]="isSubmenuFlyout"
                [class.layout-submenu-panel]="isSubmenuFlyout"
                [class.layout-submenu-panel--open]="isSubmenuFlyout && active"
                [ngStyle]="isSubmenuFlyout && active ? flyoutPanelStyle : null"
                (mouseenter)="onFlyoutPanelEnter()"
                (mouseleave)="onFlyoutPanelLeave()">
                <li *ngIf="isSubmenuFlyout" class="layout-submenu-panel-header" aria-hidden="true">
                    <span>{{ item.label }}</span>
                </li>
				<ng-template ngFor let-child let-i="index" [ngForOf]="item.items">
					<li app-menuitem [item]="child" [index]="i" [parentKey]="key" [class]="child.badgeClass"></li>
				</ng-template>
			</ul>
		</ng-container>
    `,
    animations: [
        trigger('children', [
            state('collapsed', style({
                height: '0'
            })),
            state('expanded', style({
                height: '*'
            })),
            transition('collapsed <=> expanded', animate('400ms cubic-bezier(0.86, 0, 0.07, 1)'))
        ])
    ]
})
export class AppMenuitemComponent implements OnInit, OnDestroy {

    @Input() item: any;

    @Input() index!: number;

    @Input() @HostBinding('class.layout-root-menuitem') root!: boolean;

    @Input() parentKey!: string;

    active = false;

    menuSourceSubscription: Subscription;

    menuResetSubscription: Subscription;

    key: string = "";

    flyoutPanelStyle: Record<string, string> = {};

    private flyoutCloseTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        public layoutService: LayoutService,
        private cd: ChangeDetectorRef,
        public router: Router,
        private menuService: MenuService,
        private el: ElementRef<HTMLElement>,
    ) {
        this.menuSourceSubscription = this.menuService.menuSource$.subscribe(value => {
            Promise.resolve(null).then(() => {
                if (value.routeEvent) {
                    if (this.isSubmenuFlyout) {
                        this.active = false;
                    } else {
                        this.active = (value.key === this.key || value.key.startsWith(this.key + '-')) ? true : false;
                    }
                }
                else {
                    if (value.key !== this.key && !value.key.startsWith(this.key + '-')) {
                        this.active = false;
                    }
                }

                if (!this.active) {
                    this.clearFlyoutPanel();
                } else if (this.isSubmenuFlyout) {
                    this.updateFlyoutPosition();
                }

                this.cd.markForCheck();
            });
        });

        this.menuResetSubscription = this.menuService.resetSource$.subscribe(() => {
            this.active = false;
            this.clearFlyoutPanel();
            this.cd.markForCheck();
        });

        this.router.events.pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                if (this.isIconRailMode()) {
                    this.active = false;
                    this.clearFlyoutPanel();
                    this.cd.markForCheck();
                }

                if (this.item.routerLink) {
                    this.updateActiveStateFromRoute();
                } else if (this.item.items && !this.isIconRailMode()) {
                    this.updateActiveFromDescendants();
                }
            });
    }

    ngOnInit() {
        this.key = this.parentKey ? this.parentKey + '-' + this.index : String(this.index);

        if (this.item.routerLink) {
            this.updateActiveStateFromRoute();
        } else if (this.item.items) {
            this.updateActiveFromDescendants();
        }
    }

    updateActiveStateFromRoute() {
        let activeRoute = this.router.isActive(this.item.routerLink[0], { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' });

        if (activeRoute) {
            this.menuService.onMenuStateChange({ key: this.key, routeEvent: true });
        }
    }

    /** Expand collapsible groups (e.g. document-chain submenu) when the current URL matches a nested leaf. */
    private updateActiveFromDescendants(): void {
        if (!this.item.items?.length) {
            return;
        }
        if (this.descendantHasActiveRoute(this.item.items)) {
            this.active = true;
            this.menuService.onMenuStateChange({ key: this.key, routeEvent: true });
            this.cd.markForCheck();
        }
    }

    private descendantHasActiveRoute(items: any[]): boolean {
        for (const child of items) {
            if (child.routerLink?.length && (!child.items || child.items.length === 0)) {
                if (this.leafRouteActive(child)) {
                    return true;
                }
            }
            if (child.items?.length && this.descendantHasActiveRoute(child.items)) {
                return true;
            }
        }
        return false;
    }

    private leafRouteActive(leaf: any): boolean {
        try {
            const extras: { queryParams?: Record<string, unknown>; queryParamsHandling?: 'merge' | 'preserve' | '' } = {};
            if (leaf.queryParams !== undefined) {
                extras.queryParams = leaf.queryParams;
            }
            if (leaf.queryParamsHandling !== undefined && leaf.queryParamsHandling !== null) {
                extras.queryParamsHandling = leaf.queryParamsHandling;
            }
            const tree = this.router.createUrlTree(leaf.routerLink, extras);
            const opts = (leaf.routerLinkActiveOptions || {
                paths: 'exact',
                queryParams: 'ignored',
                matrixParams: 'ignored',
                fragment: 'ignored',
            }) as IsActiveMatchOptions;
            return this.router.isActive(tree, opts);
        } catch {
            return false;
        }
    }

    itemClick(event: Event) {
        // avoid processing disabled items
        if (this.item.disabled) {
            event.preventDefault();
            return;
        }

        // execute command
        if (this.item.command) {
            this.item.command({ originalEvent: event, item: this.item });
        }

        let willOpen = false;

        // toggle active state
        if (this.item.items) {
            if (this.isSubmenuFlyout) {
                event.preventDefault();
                event.stopPropagation();
            }

            willOpen = !this.active;
            this.active = willOpen;

            if (willOpen && this.isSubmenuFlyout) {
                this.cancelFlyoutClose();
                this.updateFlyoutPosition();
            } else {
                this.clearFlyoutPanel();
            }
        }

        this.menuService.onMenuStateChange({ key: this.key });

        if (this.layoutService.isMenuHoverMode() && !this.item.items) {
            this.layoutService.collapseMenuHover();
        }

        if (this.isIconRailMode() && !this.item.items) {
            this.menuService.reset();
        }

        this.cd.markForCheck();
    }

    @HostListener('mouseenter')
    onHostMouseEnter(): void {
        if (!this.isSubmenuFlyout || !this.item.items) {
            return;
        }

        this.cancelFlyoutClose();

        if (!this.active) {
            this.active = true;
            this.menuService.onMenuStateChange({ key: this.key });
        }

        this.updateFlyoutPosition();
        this.cd.markForCheck();
    }

    @HostListener('mouseleave')
    onHostMouseLeave(): void {
        if (!this.isSubmenuFlyout || !this.active) {
            return;
        }

        this.scheduleFlyoutClose();
    }

    onFlyoutPanelEnter(): void {
        if (!this.isSubmenuFlyout) {
            return;
        }

        this.cancelFlyoutClose();
    }

    onFlyoutPanelLeave(): void {
        if (!this.isSubmenuFlyout || !this.active) {
            return;
        }

        this.scheduleFlyoutClose();
    }

    @HostListener('window:resize')
    @HostListener('window:scroll')
    onViewportChange(): void {
        if (this.isSubmenuFlyout && this.active) {
            this.updateFlyoutPosition();
        }
    }

    private updateFlyoutPosition(): void {
        requestAnimationFrame(() => {
            const anchor = this.el.nativeElement.querySelector(':scope > a') as HTMLElement | null;
            if (!anchor) {
                return;
            }

            const rect = anchor.getBoundingClientRect();
            const rtl = document.documentElement.dir === 'rtl';
            const gap = 8;
            const minWidth = 216;
            const maxHeight = Math.min(window.innerHeight * 0.7, 384);
            const top = Math.min(rect.top, window.innerHeight - maxHeight - 8);

            if (rtl) {
                this.flyoutPanelStyle = {
                    position: 'fixed',
                    top: `${Math.max(8, top)}px`,
                    right: `${window.innerWidth - rect.left + gap}px`,
                    left: 'auto',
                    minWidth: `${minWidth}px`,
                    maxHeight: `${maxHeight}px`,
                    zIndex: '1200',
                };
            } else {
                this.flyoutPanelStyle = {
                    position: 'fixed',
                    top: `${Math.max(8, top)}px`,
                    left: `${rect.right + gap}px`,
                    minWidth: `${minWidth}px`,
                    maxHeight: `${maxHeight}px`,
                    zIndex: '1200',
                };
            }

            this.cd.markForCheck();
        });
    }

    private scheduleFlyoutClose(): void {
        this.cancelFlyoutClose();
        this.flyoutCloseTimer = setTimeout(() => {
            this.active = false;
            this.clearFlyoutPanel();
            this.cd.markForCheck();
        }, 180);
    }

    private cancelFlyoutClose(): void {
        if (this.flyoutCloseTimer) {
            clearTimeout(this.flyoutCloseTimer);
            this.flyoutCloseTimer = null;
        }
    }

    private clearFlyoutPanel(): void {
        this.cancelFlyoutClose();
        this.flyoutPanelStyle = {};
    }

    get isSubmenuFlyout(): boolean {
        return !this.root && this.isIconRailMode();
    }

    private isIconRailMode(): boolean {
        return this.layoutService.isMenuCompact()
            || (this.layoutService.isMenuHoverMode() && !this.layoutService.isMenuHoverExpanded());
    }

    get submenuAnimation() {
        return this.root ? 'expanded' : (this.active ? 'expanded' : 'collapsed');
    }

    get menuTooltipDisabled(): boolean {
        return !this.isIconRailMode();
    }

    get menuTooltipPosition(): string {
        return document.documentElement.dir === 'rtl' ? 'left' : 'right';
    }

    @HostBinding('class.active-menuitem') 
    get activeClass() {
        return this.active && !this.root;
    }

    ngOnDestroy() {
        if (this.menuSourceSubscription) {
            this.menuSourceSubscription.unsubscribe();
        }

        if (this.menuResetSubscription) {
            this.menuResetSubscription.unsubscribe();
        }

        this.cancelFlyoutClose();
    }
}
