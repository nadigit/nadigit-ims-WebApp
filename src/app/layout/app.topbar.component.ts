import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { LayoutService } from "./service/app.layout.service";
import { KeycloakService } from 'keycloak-angular';
import { NotificationService } from '../services/notification.service';
import { Notification } from '../models/notification';
import * as moment from 'moment';
import { KeycloakProfile } from 'keycloak-js';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '../services/translation.service';


@Component({
    selector: 'app-topbar',
    templateUrl: './app.topbar.component.html'
})
export class AppTopBarComponent implements OnInit {

    items!: MenuItem[];

    notificationVisible: boolean = false;
    notifications: Notification[] = [];
    recentNotifications: Notification[] = [];
    olderNotifications: Notification[] = [];
    recentPage: number = 0;
    notificationsPage: number = 0;
    pageSize: number = 10;
    loadMoreVisible: boolean = true;
    displayedNotificationIds: Set<number> = new Set<number>();
    profile: KeycloakProfile;


    @ViewChild('menubutton') menuButton!: ElementRef;

    @ViewChild('topbarmenubutton') topbarMenuButton!: ElementRef;

    @ViewChild('topbarmenu') menu!: ElementRef;
  

    constructor(public layoutService: LayoutService, 
                public keycloakService: KeycloakService,
                private notificationService: NotificationService,
                private cdRef: ChangeDetectorRef,
                private translate: TranslateService,
                private translateService: TranslationService,) {

    }
    async ngOnInit(): Promise<void> {
      this.translateService.currentLanguage$.subscribe(lang => {
        this.translate.use(lang); // Use the translate service to update language
    });
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => {
      this.setupMenu(translations);
    });
      this.profile = await this.keycloakService.loadUserProfile();
      console.log(this.profile)
        this.items = [
            {
                label: 'Settings',
                icon: 'pi pi-fw pi-wrench',
                routerLink: '/pages/profile'
            },
            {
                label: 'Logout',
                icon: 'pi pi-fw pi-power-off',
                command: () => this.logOut()
            },
        ];
        this.loadRecentNotifications();
    }

    setupMenu(translations: any) {    
      this.items = [
        {
            label: translations['settings'],
            icon: 'pi pi-fw pi-wrench',
            routerLink: '/pages/profile'
        },
        {
            label: translations['logout'],
            icon: 'pi pi-fw pi-power-off',
            command: () => this.logOut()
        },
    ];
    }

    showNotifications() {
        console.log("clicked");
        const notificationCount = this.recentNotifications?.length ?? 0;
        console.log(notificationCount);
        this.notificationVisible = !this.notificationVisible;
      }

    logOut() {
        this.keycloakService.logout(window.location.origin)
    }

    // loadNotifications() {
    //     this.notificationService.getNotifications().subscribe(
    //       notifications => {
    //         this.notifications = notifications;
    //       },
    //       error => {
    //         console.error('Error fetching notifications:', error);
    //       }
    //     );
    //   }

    loadRecentNotifications() {
        this.notificationService.getRecentNotifications(this.recentPage, this.pageSize).subscribe(
          data => {
            const today = moment().startOf('day');
    
            // Filter and add notifications to recentNotifications
            const newRecentNotifications = data.content.filter((notification: any) =>
              moment(notification.creationDate).isSameOrAfter(today) && !this.displayedNotificationIds.has(notification.id)
            );
    
            this.recentNotifications = this.recentNotifications.concat(newRecentNotifications);
            newRecentNotifications.forEach(notification => this.displayedNotificationIds.add(notification.id));
    
            // Filter and add notifications to olderNotifications
            const newOlderNotifications = data.content.filter((notification: any) =>
              moment(notification.creationDate).isBefore(today) && !this.displayedNotificationIds.has(notification.id)
            );
    
            this.olderNotifications = this.olderNotifications.concat(newOlderNotifications);
            newOlderNotifications.forEach(notification => this.displayedNotificationIds.add(notification.id));
    
            if (!data.last) {
              this.recentPage++;
            } else {
              this.loadMoreVisible = false;
            }
            console.log(this.recentNotifications)
          },
          error => console.error(error)
        );
      }
    
      loadMoreNotifications() {
        this.notificationService.getNotifications(this.notificationsPage, this.pageSize).subscribe(
          data => {
            // Filter out already displayed notifications
            const newOlderNotifications = data.content.filter((notification: any) =>
              !this.displayedNotificationIds.has(notification.id)
            );
    
            this.olderNotifications = this.olderNotifications.concat(newOlderNotifications);
            newOlderNotifications.forEach(notification => this.displayedNotificationIds.add(notification.id));
    
            if (!data.last) {
              this.notificationsPage++;
            }
    
            // Hide the load more button if no more notifications are available
            if (newOlderNotifications.length === 0 && data.last) {
              this.loadMoreVisible = false;
            }
          },
          error => console.error(error)
        );
      }

      getCustomMessage(notification: Notification): string {
        let notificationTitles = ["product in low stock", "product is out of stock"]

        if (notificationTitles.includes(notification.title)){
        // Extract product name
        const productNameMatch = notification.message.match(/\(([^)]+)\)/);
        return productNameMatch ? productNameMatch[1] : null;        
      }
      return notification.message;
    }

}
